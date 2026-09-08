const prisma = require("../db");
const { verifyToken, COOKIE_NAME } = require("../lib/jwt");

async function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.user = user;
  } catch {
    // token invalid/expired — treat as guest
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Bu amal uchun ruxsatingiz yo'q" });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
