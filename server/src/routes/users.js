const express = require("express");
const prisma = require("../db");
const { hashPassword } = require("../lib/password");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isOnline, onlineCount } = require("../lib/presence");
const { ROLES } = require("../lib/constants");

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return { ...rest, isOnline: isOnline(user.id) };
}

// Faqat asosiy o'qituvchi (role=TEACHER) boshqa birovni "teacher" qila oladi
// yoki mavjud teacher hisobini tahrirlay/o'chira oladi — ТЗ §9.
function canManageTargetRole(actorRole, targetRole) {
  if (targetRole === "TEACHER") return actorRole === "TEACHER";
  return actorRole === "TEACHER" || actorRole === "ADMIN";
}

router.get("/stats", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const totalStudents = await prisma.user.count({ where: { role: "STUDENT" } });
  res.json({ totalStudents, online: onlineCount() });
});

// Har qanday tizimga kirgan foydalanuvchi ko'ra oladigan qisqartirilgan
// reyting ro'yxati — Bosh sahifadagi "Reyting" bloki uchun.
router.get("/leaderboard", requireAuth, async (req, res) => {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { points: "desc" },
    take: 10,
    select: { id: true, firstName: true, lastName: true, points: true },
  });
  res.json({ users: students });
});

router.get("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { search = "", sort = "firstName" } = req.query;
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { university: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { [["firstName", "lastName", "role", "university"].includes(sort) ? sort : "firstName"]: "asc" },
  });
  res.json({ users: users.map(publicUser) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { firstName, lastName, university, email } = req.body;
  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (university !== undefined) data.university = university;
  if (email !== undefined) data.email = email;

  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
});

router.get("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  res.json({ user: publicUser(user) });
});

router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { firstName, lastName, university, email, login, role = "STUDENT", password } = req.body;
  if (!firstName || !lastName || !email || !login || !password) {
    return res.status(400).json({ error: "Barcha majburiy maydonlarni to'ldiring" });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Noto'g'ri rol" });
  if (!canManageTargetRole(req.user.role, role)) {
    return res.status(403).json({ error: "Faqat asosiy o'qituvchi teacher rolini belgilay oladi" });
  }

  const loginTaken = await prisma.user.findUnique({ where: { login } });
  if (loginTaken) return res.status(409).json({ error: "Bunday login mavjud" });
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) return res.status(409).json({ error: "Bu pochta band" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { firstName, lastName, university: university || null, email, login, role, passwordHash },
  });
  res.status(201).json({ user: publicUser(user) });
});

router.patch("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  if (!canManageTargetRole(req.user.role, target.role)) {
    return res.status(403).json({ error: "Ushbu foydalanuvchini faqat asosiy o'qituvchi tahrirlashi mumkin" });
  }

  const { firstName, lastName, university, email, login, role, password } = req.body;
  if (role !== undefined && !canManageTargetRole(req.user.role, role)) {
    return res.status(403).json({ error: "Faqat asosiy o'qituvchi teacher rolini belgilay oladi" });
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
});

router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
  if (!canManageTargetRole(req.user.role, target.role)) {
    return res.status(403).json({ error: "Ushbu foydalanuvchini faqat asosiy o'qituvchi o'chirishi mumkin" });
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});

module.exports = router;
