const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { MAX_UPLOAD_BYTES } = require("../lib/constants");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  // fieldSize — multipart so'rovdagi MATN maydonlari uchun (multer'da standart
  // qiymati 1MB). Post/banner matni rich-text HTML sifatida aynan shu yo'l
  // bilan (FormData) yuboriladi, shuning uchun chegara oshirilgan.
  limits: { fileSize: MAX_UPLOAD_BYTES, fieldSize: 2 * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
