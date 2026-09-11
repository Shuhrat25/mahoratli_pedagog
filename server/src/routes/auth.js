const express = require("express");
const prisma = require("../db");
const { hashPassword, verifyPassword } = require("../lib/password");
const { generateCode, hashCode, verifyCode, expiryDate } = require("../lib/codes");
const { sendVerificationEmail, isConfigured } = require("../lib/mailer");
const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  signVerifiedEmailToken,
  verifyVerifiedEmailToken,
} = require("../lib/jwt");
const { requireAuth } = require("../middleware/auth");
const { VERIFICATION_PURPOSES, validatePassword } = require("../lib/constants");
const { rateLimit } = require("../lib/rateLimit");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();
const isDev = process.env.NODE_ENV !== "production";

// Parolni cheksiz tanlash va birovning pochtasiga cheksiz kod yuborishning
// oldini oladi (Resend kvotasini ham asraydi).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "login",
  message: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring.",
});
const codeLimiterByIp = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "code-ip" });
const codeLimiterByEmail = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "code-email",
  key: (req) => String(req.body?.email || "").toLowerCase(),
  message: "Bu pochtaga juda ko'p kod yuborildi. Bir soatdan so'ng urinib ko'ring.",
});
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, keyPrefix: "verify" });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "register" });

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

async function issueCode(email, purpose) {
  const code = generateCode();
  const codeHash = await hashCode(code);
  await prisma.emailVerification.deleteMany({ where: { email, purpose, verified: false } });
  await prisma.emailVerification.create({ data: { email, purpose, codeHash, expiresAt: expiryDate() } });

  let emailSent = false;
  if (isConfigured()) {
    try {
      await sendVerificationEmail(email, code, purpose);
      emailSent = true;
    } catch (err) {
      console.error("[email-verification] Resend orqali yuborishda xatolik:", err.message);
    }
  }
  if (!emailSent) {
    // Resend sozlanmagan yoki yuborish muvaffaqiyatsiz bo'lsa — dev muhitida
    // kod konsolga va javobga chiqadi, shunda ishlashda davom etish mumkin.
    console.log(`[email-verification] ${email} (${purpose}) kod: ${code}`);
  }
  return { code, emailSent };
}

router.post(
  "/send-code",
  codeLimiterByIp,
  codeLimiterByEmail,
  route(async (req, res) => {
    const { email, purpose } = req.body;
    if (!email || !VERIFICATION_PURPOSES.includes(purpose)) {
      throw new HttpError(400, "email va purpose talab qilinadi");
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    // Ro'yxatdan o'tishda "bu pochta band" degan xabar zarur (aks holda
    // foydalanuvchi nima uchun o'ta olmayotganini tushunmaydi).
    if (purpose === "REGISTER" && existingUser) {
      throw new HttpError(409, "Bu pochta bilan foydalanuvchi allaqachon mavjud");
    }

    // Parolni tiklashda esa aksincha — pochta bazada bor-yo'qligini oshkor
    // qilmaymiz, aks holda bu foydalanuvchilar ro'yxatini terib olish yo'li
    // bo'lardi. Javob har doim bir xil.
    if (purpose === "RESET" && !existingUser) {
      return res.json({ ok: true, emailSent: true });
    }

    const { code, emailSent } = await issueCode(email, purpose);
    res.json({ ok: true, emailSent, ...(isDev && !emailSent ? { devCode: code } : {}) });
  })
);

router.post(
  "/verify-code",
  verifyLimiter,
  route(async (req, res) => {
    const { email, code, purpose } = req.body;
    if (!email || !code || !VERIFICATION_PURPOSES.includes(purpose)) {
      throw new HttpError(400, "email, code va purpose talab qilinadi");
    }

    const record = await prisma.emailVerification.findFirst({
      where: { email, purpose, verified: false },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new HttpError(400, "Kod muddati tugagan, qaytadan so'rang");
    }
    const ok = await verifyCode(code, record.codeHash);
    if (!ok) throw new HttpError(400, "Kod noto'g'ri");

    await prisma.emailVerification.update({ where: { id: record.id }, data: { verified: true } });
    const verifiedToken = signVerifiedEmailToken(email, purpose);
    res.json({ ok: true, verifiedToken });
  })
);

router.get(
  "/check-login/:login",
  route(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { login: req.params.login } });
    res.json({ taken: !!user });
  })
);

router.post(
  "/register",
  registerLimiter,
  route(async (req, res) => {
    const { firstName, lastName, university, password, email, login, verifiedToken } = req.body;
    if (!firstName || !lastName || !password || !email || !login || !verifiedToken) {
      throw new HttpError(400, "Barcha majburiy maydonlarni to'ldiring");
    }

    const passwordError = validatePassword(password);
    if (passwordError) throw new HttpError(400, passwordError);

    let payload;
    try {
      payload = verifyVerifiedEmailToken(verifiedToken, "REGISTER");
    } catch {
      throw new HttpError(400, "Pochta tasdiqlanmagan yoki token muddati tugagan");
    }
    if (payload.email !== email) throw new HttpError(400, "Pochta manzili mos kelmadi");

    const loginTaken = await prisma.user.findUnique({ where: { login } });
    if (loginTaken) throw new HttpError(409, "Bunday login mavjud, iltimos boshqa o'ylab toping");
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw new HttpError(409, "Bu pochta bilan foydalanuvchi allaqachon mavjud");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { firstName, lastName, university: university || null, email, login, passwordHash, role: "STUDENT" },
    });

    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  "/login",
  loginLimiter,
  route(async (req, res) => {
    const { loginOrEmail, password } = req.body;
    if (!loginOrEmail || !password) throw new HttpError(400, "Login/pochta va parol talab qilinadi");

    const user = await prisma.user.findFirst({
      where: { OR: [{ login: loginOrEmail }, { email: loginOrEmail }] },
    });
    if (!user) throw new HttpError(401, "Login yoki parol noto'g'ri");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Login yoki parol noto'g'ri");

    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user) });
  })
);

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post(
  "/forgot-password/reset",
  registerLimiter,
  route(async (req, res) => {
    const { email, newPassword, verifiedToken } = req.body;
    if (!email || !newPassword || !verifiedToken) throw new HttpError(400, "Barcha maydonlar talab qilinadi");

    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new HttpError(400, passwordError);

    let payload;
    try {
      payload = verifyVerifiedEmailToken(verifiedToken, "RESET");
    } catch {
      throw new HttpError(400, "Pochta tasdiqlanmagan yoki token muddati tugagan");
    }
    if (payload.email !== email) throw new HttpError(400, "Pochta manzili mos kelmadi");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  })
);

module.exports = router;
