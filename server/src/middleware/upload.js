const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const {
  MAX_STUDENT_UPLOAD_BYTES,
  MAX_FIELD_BYTES,
  STUDENT_ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
} = require("../lib/constants");
const { HttpError } = require("../lib/httpError");

const prisma = require('../db');
const { rateLimit } = require('../lib/rateLimit');
const { removeUnreferencedUpload } = require('../lib/uploadCleanup');
const studentLimiter = rateLimit({ windowMs: 3600000, max: 20, keyPrefix: 'uploads', key: (req) => req.user.id });
const STUDENT_QUOTA = Math.max(100, Number(process.env.STUDENT_UPLOAD_QUOTA_MB) || 500) * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

function isStaff(user) {
  return user?.role === "TEACHER" || user?.role === "ADMIN";
}

function extensionOf(file) {
  return path.extname(file.originalname || "").toLowerCase();
}

// O'qituvchi/admin istalgan o'quv materialini yuklaydi — faqat bevosita
// ishga tushadigan fayllar taqiqlanadi. Talaba esa faqat topshiriq topshirish
// uchun mos formatlarni yuklay oladi (ruxsat etilganlar ro'yxati).
function fileFilter(req, file, cb) {
  const ext = extensionOf(file);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new HttpError(400, `${ext || "Bu"} turidagi fayllarni yuklash mumkin emas`));
  }
  if (!isStaff(req.user) && !STUDENT_ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new HttpError(
        400,
        `Bu fayl turi qabul qilinmaydi. Ruxsat etilganlar: ${STUDENT_ALLOWED_EXTENSIONS.join(", ")}`
      )
    );
  }
  cb(null, true);
}

// Talabalar uchun 10MB chegara; o'qituvchi/admin uchun hajm chegarasi yo'q
// (katta videodars, skanerlangan qo'llanma va h.k.). fieldSize esa ikkalasida
// ham bor — bu MATN maydonlari uchun (rich-text HTML shu yo'l bilan keladi).
const studentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_STUDENT_UPLOAD_BYTES, fieldSize: MAX_FIELD_BYTES, fields: 20, parts: 40 },
});

const staffUpload = multer({
  storage,
  fileFilter,
  limits: { fieldSize: MAX_FIELD_BYTES },
});

function pick(req) {
  return isStaff(req.user) ? staffUpload : studentUpload;
}

// Multer chegaralari instans yaratilganda belgilanadi, biz esa ularni
// so'rovdagi rolga qarab tanlashimiz kerak — shuning uchun o'rovchi.
function handleUpload(kind, field, maxCount) {
  return (req, res, next) => {
    const run = async () => {
      const staff = isStaff(req.user);
      if (!staff) {
        const usage = await prisma.uploadedFile.aggregate({ where: { uploadedById: req.user.id }, _sum: { size: true } });
        if ((usage._sum.size || 0) >= STUDENT_QUOTA) throw new HttpError(413, "Fayllar uchun umumiy joy tugadi. O'qituvchiga murojaat qiling.");
      }
      const parser = kind === 'single' ? pick(req).single(field) : pick(req).array(field, maxCount);
      parser(req, res, (err) => {
        const files = req.file ? [req.file] : req.files || [];
        res.once('finish', () => {
          if (res.statusCode >= 400) for (const f of files) removeUnreferencedUpload(f.filename).catch(() => {});
        });
        if (err) return next(err);
        (async () => {
          if (!staff) {
            const usage = await prisma.uploadedFile.aggregate({ where: { uploadedById: req.user.id }, _sum: { size: true } });
            if ((usage._sum.size || 0) + files.reduce((sum, f) => sum + f.size, 0) > STUDENT_QUOTA) throw new HttpError(413, "Fayllar uchun umumiy joy tugadi");
          }
          next();
        })().catch(next);
      });
    };
    if (isStaff(req.user)) run().catch(next);
    else studentLimiter(req, res, () => run().catch(next));
  };
}
const upload = {
  single: (field) => handleUpload('single', field),
  array: (field, maxCount) => handleUpload('array', field, maxCount),
};

module.exports = { upload, UPLOAD_DIR, isStaff };
