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
const { VERIFICATION_PURPOSES } = require("../lib/constants");

const router = express.Router();
const isDev = process.env.NODE_ENV !== "production";

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post("/send-code", async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !VERIFICATION_PURPOSES.includes(purpose)) {
    return res.status(400).json({ error: "email va purpose talab qilinadi" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (purpose === "REGISTER" && existingUser) {
    return res.status(409).json({ error: "Bu pochta bilan foydalanuvchi allaqachon mavjud" });
  }
  if (purpose === "RESET" && !existingUser) {
    return res.status(404).json({ error: "Bu pochta bilan foydalanuvchi topilmadi" });
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  await prisma.emailVerification.deleteMany({ where: { email, purpose, verified: false } });
  await prisma.emailVerification.create({
    data: { email, purpose, codeHash, expiresAt: expiryDate() },
  });

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

  res.json({ ok: true, emailSent, ...(isDev && !emailSent ? { devCode: code } : {}) });
});

router.post("/verify-code", async (req, res) => {
  const { email, code, purpose } = req.body;
  if (!email || !code || !VERIFICATION_PURPOSES.includes(purpose)) {
    return res.status(400).json({ error: "email, code va purpose talab qilinadi" });
  }

  const record = await prisma.emailVerification.findFirst({
    where: { email, purpose, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "Kod muddati tugagan, qaytadan so'rang" });
  }
  const ok = await verifyCode(code, record.codeHash);
  if (!ok) return res.status(400).json({ error: "Kod noto'g'ri" });

  await prisma.emailVerification.update({ where: { id: record.id }, data: { verified: true } });
  const verifiedToken = signVerifiedEmailToken(email, purpose);
  res.json({ ok: true, verifiedToken });
});

router.get("/check-login/:login", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { login: req.params.login } });
  res.json({ taken: !!user });
});

router.post("/register", async (req, res) => {
  const { firstName, lastName, university, password, email, login, verifiedToken } = req.body;
  if (!firstName || !lastName || !password || !email || !login || !verifiedToken) {
    return res.status(400).json({ error: "Barcha majburiy maydonlarni to'ldiring" });
  }

  let payload;
  try {
    payload = verifyVerifiedEmailToken(verifiedToken, "REGISTER");
  } catch {
    return res.status(400).json({ error: "Pochta tasdiqlanmagan yoki token muddati tugagan" });
  }
  if (payload.email !== email) {
    return res.status(400).json({ error: "Pochta manzili mos kelmadi" });
  }

  const loginTaken = await prisma.user.findUnique({ where: { login } });
  if (loginTaken) {
    return res.status(409).json({ error: "Bunday login mavjud, iltimos boshqa o'ylab toping" });
  }
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    return res.status(409).json({ error: "Bu pochta bilan foydalanuvchi allaqachon mavjud" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { firstName, lastName, university: university || null, email, login, passwordHash, role: "STUDENT" },
  });

  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { loginOrEmail, password } = req.body;
  if (!loginOrEmail || !password) {
    return res.status(400).json({ error: "Login/pochta va parol talab qilinadi" });
  }
  const user = await prisma.user.findFirst({
    where: { OR: [{ login: loginOrEmail }, { email: loginOrEmail }] },
  });
  if (!user) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Login yoki parol noto'g'ri" });

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/forgot-password/reset", async (req, res) => {
  const { email, newPassword, verifiedToken } = req.body;
  if (!email || !newPassword || !verifiedToken) {
    return res.status(400).json({ error: "Barcha maydonlar talab qilinadi" });
  }
  let payload;
  try {
    payload = verifyVerifiedEmailToken(verifiedToken, "RESET");
  } catch {
    return res.status(400).json({ error: "Pochta tasdiqlanmagan yoki token muddati tugagan" });
  }
  if (payload.email !== email) {
    return res.status(400).json({ error: "Pochta manzili mos kelmadi" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

module.exports = router;
