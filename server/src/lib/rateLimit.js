// Oddiy, kutubxonasiz rate limiter (xotirada).
//
// Nima uchun: /auth/login parolni cheksiz marta tanlashga, /auth/send-code esa
// birovning pochtasiga cheksiz kod yuborishga (va Resend kvotasini yoqishga)
// imkon berardi.
//
// Cheklov: sanoq shu jarayon xotirasida — bir nechta instansda ishlaganda har
// biri o'z hisobini yuritadi. Bitta instans uchun (Render free tier) yetarli;
// kengaytirilganda Redis'ga ko'chirish kerak bo'ladi.

const buckets = new Map();

function clientKey(req) {
  // Render/Vercel proksisi ortida haqiqiy IP shu sarlavhada keladi.
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || "").split(",")[0].trim();
  return ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit({ windowMs, max, keyPrefix = "", message, key }) {
  return (req, res, next) => {
    const id = `${keyPrefix}:${key ? key(req) : clientKey(req)}`;
    const now = Date.now();
    const bucket = buckets.get(id);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message || `Juda ko'p urinish. ${retryAfter} soniyadan so'ng qayta urinib ko'ring.`,
      });
    }
    next();
  };
}

// Eskirgan yozuvlarni tozalab turish — xotira cheksiz o'smasligi uchun.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}, 5 * 60 * 1000);
cleanup.unref?.();

module.exports = { rateLimit, clientKey };
