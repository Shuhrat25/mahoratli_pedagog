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
  limits: { fileSize: MAX_STUDENT_UPLOAD_BYTES, fieldSize: MAX_FIELD_BYTES },
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
const upload = {
  single: (field) => (req, res, next) => pick(req).single(field)(req, res, next),
  array: (field, maxCount) => (req, res, next) => pick(req).array(field, maxCount)(req, res, next),
};

module.exports = { upload, UPLOAD_DIR, isStaff };
