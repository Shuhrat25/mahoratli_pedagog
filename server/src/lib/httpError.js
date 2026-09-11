// Marshrutlardagi xatolarni bir joyda, tushunarli javobga aylantirish.
//
// Ilgari `prisma.post.delete()` mavjud bo'lmagan id bilan chaqirilsa Prisma
// P2025 xatosi otilardi va u umumiy 500 "Server xatosi" bo'lib chiqardi.
// Endi u 404 "Topilmadi" bo'ladi, band email esa 409 bo'lib qaytadi.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const PRISMA_FIELD_LABELS = {
  email: "pochta",
  login: "login",
};

function describeTarget(target) {
  const fields = Array.isArray(target) ? target : [target].filter(Boolean);
  if (fields.length === 0) return null;
  return fields.map((f) => PRISMA_FIELD_LABELS[f] || f).join(", ");
}

/** Prisma xatosini HTTP status + xabarga aylantiradi. */
function toHttpError(err) {
  if (err instanceof HttpError) return err;

  switch (err?.code) {
    case "P2025": // topilmadi
      return new HttpError(404, "So'ralgan yozuv topilmadi");
    case "P2002": {
      // unique cheklov buzildi
      const field = describeTarget(err.meta?.target);
      return new HttpError(409, field ? `Bu ${field} allaqachon band` : "Bunday yozuv allaqachon mavjud");
    }
    case "P2003": // tashqi kalit
      return new HttpError(400, "Bog'liq yozuv topilmadi");
    case "P2000":
      return new HttpError(400, "Kiritilgan qiymat juda uzun");
    default:
      return null;
  }
}

/**
 * Async marshrut ishlovchisini o'raydi: `throw new HttpError(...)` va Prisma
 * xatolari to'g'ri statusga aylanadi, kutilmagan xatolar esa Express'ning
 * umumiy ishlovchisiga (500) o'tadi.
 */
function route(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((err) => {
      const mapped = toHttpError(err);
      if (mapped) return res.status(mapped.status).json({ error: mapped.message });
      next(err);
    });
  };
}

module.exports = { HttpError, route, toHttpError };
