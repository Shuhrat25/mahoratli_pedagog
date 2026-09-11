const ROLES = ["STUDENT", "ADMIN", "TEACHER"];
const LESSON_TYPES = ["VIDEO", "TEXT", "TEST", "LIVE"];
const SUBMISSION_STATUSES = ["NOT_REVIEWED", "REVIEWED"];
const VERIFICATION_PURPOSES = ["REGISTER", "RESET"];
const POST_STATUSES = ["DRAFT", "PUBLISHED"];

// Talabalar uchun fayl hajmi chegarasi (ТЗ §9). O'qituvchi va admin uchun
// chegara yo'q — ular katta o'quv materiallarini yuklashadi.
const MAX_STUDENT_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// Multipart so'rovdagi MATN maydoni uchun chegara — rich-text HTML shu yo'l
// bilan keladi (post/banner matni), multer'dagi standart 1MB kam bo'lishi mumkin.
const MAX_FIELD_BYTES = 2 * 1024 * 1024;

// Bevosita ishga tushadigan fayllar — hech kimga ruxsat berilmaydi.
const BLOCKED_EXTENSIONS = [
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".pif", ".cpl", ".jar",
  ".js", ".jse", ".vbs", ".vbe", ".ps1", ".psm1", ".sh", ".app", ".dmg",
  ".deb", ".rpm", ".apk", ".dll", ".sys", ".hta", ".reg", ".lnk",
];

// Talaba topshiriq sifatida yuklashi mumkin bo'lgan formatlar.
const STUDENT_ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt",
  ".xls", ".xlsx", ".ods", ".csv",
  ".ppt", ".pptx", ".odp",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".svg",
  ".mp3", ".wav", ".m4a", ".ogg",
  ".mp4", ".mov", ".webm",
  ".zip", ".rar", ".7z",
];

// Parol talablari — ilgari hech qanday tekshiruv yo'q edi ("1" ham o'tardi).
const MIN_PASSWORD_LENGTH = 8;

function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Parolda kamida bitta harf va bitta raqam bo'lishi kerak";
  }
  return null;
}

module.exports = {
  ROLES,
  LESSON_TYPES,
  SUBMISSION_STATUSES,
  VERIFICATION_PURPOSES,
  POST_STATUSES,
  MAX_STUDENT_UPLOAD_BYTES,
  MAX_FIELD_BYTES,
  BLOCKED_EXTENSIONS,
  STUDENT_ALLOWED_EXTENSIONS,
  MIN_PASSWORD_LENGTH,
  validatePassword,
};
