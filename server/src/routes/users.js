const express = require("express");
const prisma = require("../db");
const { hashPassword } = require("../lib/password");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isOnline, onlineCount } = require("../lib/presence");
const { ROLES, validatePassword } = require("../lib/constants");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return { ...rest, isOnline: isOnline(user) };
}

// Faqat asosiy o'qituvchi (role=TEACHER) boshqa birovni "teacher" qila oladi
// yoki mavjud teacher hisobini tahrirlay/o'chira oladi — ТЗ §9.
function canManageTargetRole(actorRole, targetRole) {
  if (targetRole === "TEACHER") return actorRole === "TEACHER";
  return actorRole === "TEACHER" || actorRole === "ADMIN";
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

router.get(
  "/stats",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const days = 30;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceKey = dayKey(since);

    const [totalStudents, online, activity] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      onlineCount(),
      // HAQIQIY tashriflar — DailyActivity yozuvlari (ilgari grafik
      // Math.random() bilan chizilardi va hech nimani anglatmasdi).
      prisma.dailyActivity.groupBy({
        by: ["day"],
        where: { day: { gte: sinceKey } },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map(activity.map((a) => [a.day, a._count._all]));
    const visits = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = dayKey(d);
      return { day: key, count: counts.get(key) || 0 };
    });

    res.json({ totalStudents, online, visits });
  })
);

// Har qanday tizimga kirgan foydalanuvchi ko'ra oladigan qisqartirilgan
// reyting ro'yxati — Bosh sahifadagi "Reyting" bloki uchun.
router.get(
  "/leaderboard",
  requireAuth,
  route(async (req, res) => {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { points: "desc" },
      take: 10,
      select: { id: true, firstName: true, lastName: true, points: true },
    });
    res.json({ users: students });
  })
);

router.get(
  "/",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { search = "", sort = "firstName" } = req.query;
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              // Postgres'da `contains` registrga SEZGIR — "abdu" so'rovi
              // "Abdurahmonov"ni topmasdi. insensitive rejim shuning uchun.
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { login: { contains: search, mode: "insensitive" } },
              { university: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { [["firstName", "lastName", "role", "university", "points"].includes(sort) ? sort : "firstName"]: "asc" },
    });
    res.json({ users: users.map(publicUser) });
  })
);

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch(
  "/me",
  requireAuth,
  route(async (req, res) => {
    const { firstName, lastName, university, email } = req.body;
    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (university !== undefined) data.university = university;
    if (email !== undefined) data.email = email;

    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ user: publicUser(user) });
  })
);

router.get(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");
    res.json({ user: publicUser(user) });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { firstName, lastName, university, email, login, role = "STUDENT", password } = req.body;
    if (!firstName || !lastName || !email || !login || !password) {
      throw new HttpError(400, "Barcha majburiy maydonlarni to'ldiring");
    }
    if (!ROLES.includes(role)) throw new HttpError(400, "Noto'g'ri rol");
    if (!canManageTargetRole(req.user.role, role)) {
      throw new HttpError(403, "Faqat asosiy o'qituvchi teacher rolini belgilay oladi");
    }
    const passwordError = validatePassword(password);
    if (passwordError) throw new HttpError(400, passwordError);

    const loginTaken = await prisma.user.findUnique({ where: { login } });
    if (loginTaken) throw new HttpError(409, "Bunday login mavjud");
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw new HttpError(409, "Bu pochta band");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { firstName, lastName, university: university || null, email, login, role, passwordHash },
    });
    res.status(201).json({ user: publicUser(user) });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, "Foydalanuvchi topilmadi");
    if (!canManageTargetRole(req.user.role, target.role)) {
      throw new HttpError(403, "Ushbu foydalanuvchini faqat asosiy o'qituvchi tahrirlashi mumkin");
    }

    const { firstName, lastName, university, email, login, role, password } = req.body;
    if (role !== undefined && !canManageTargetRole(req.user.role, role)) {
      throw new HttpError(403, "Faqat asosiy o'qituvchi teacher rolini belgilay oladi");
    }
    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) throw new HttpError(400, passwordError);
    }

    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (university !== undefined) data.university = university;
    if (email !== undefined) data.email = email;
    if (login !== undefined) data.login = login;
    if (role !== undefined) data.role = role;
    if (password) data.passwordHash = await hashPassword(password);

    const user = await prisma.user.update({ where: { id: target.id }, data });
    res.json({ user: publicUser(user) });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, "Foydalanuvchi topilmadi");
    if (!canManageTargetRole(req.user.role, target.role)) {
      throw new HttpError(403, "Ushbu foydalanuvchini faqat asosiy o'qituvchi o'chirishi mumkin");
    }
    if (target.id === req.user.id) throw new HttpError(400, "O'z hisobingizni o'chira olmaysiz");
    await prisma.user.delete({ where: { id: target.id } });
    res.json({ ok: true });
  })
);

module.exports = router;
