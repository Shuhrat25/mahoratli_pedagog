const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "mp_token";
const EXPIRES_IN = "7d";

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  const payload = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || !Number.isInteger(payload.tv) || payload.type) throw new Error("Invalid session");
  return payload;
}

// Lokal devda frontend/backend bir xil "site" hisoblanadi (ikkalasi ham
// localhost, port farqli) — sameSite=lax yetarli. Productionda esa Vercel
// (masalan mysite.vercel.app) va Render (masalan myapi.onrender.com) turli
// domenlarda tursa, bu haqiqiy cross-site so'rov hisoblanadi va faqat
// sameSite=None + secure=true bilan cookie yuboriladi (buning uchun HTTPS shart).
const isCrossSite = process.env.NODE_ENV === "production";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: isCrossSite ? "none" : "lax",
    secure: isCrossSite,
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function signVerifiedEmailToken(email, purpose, verificationId) {
  return jwt.sign({ email, purpose, verificationId, type: "email-verified" }, SECRET, { expiresIn: "15m" });
}

function verifyVerifiedEmailToken(token, purpose) {
  const payload = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  if (payload.type !== "email-verified" || payload.purpose !== purpose || typeof payload.verificationId !== "string") {
    throw new Error("Yaroqsiz tasdiqlash tokeni");
  }
  return payload;
}

module.exports = {
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
  signVerifiedEmailToken,
  verifyVerifiedEmailToken,
};
