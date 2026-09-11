// Test urinishining vaqt "oynasi".
//
// Taymer ilgari faqat brauzerda ishlardi — sahifani yangilash kifoya edi va
// hisob boshidan ketardi. Endi boshlanish vaqti bazaga yoziladi, tugash vaqti
// esa server tomonidan hisoblanadi, shuning uchun yangilash ham, tabni yopib
// qaytish ham vaqtni uzaytirmaydi.

// Tarmoqdagi kechikish tufayli talaba javobini yo'qotmasligi uchun kichik zaxira.
const GRACE_MS = 15 * 1000;

/** Urinish oynasi hali ochiqmi? */
function isWindowOpen(startedAt, timeLimitSec, now = Date.now()) {
  if (!startedAt) return false;
  if (!timeLimitSec) return true; // vaqt cheklanmagan
  return now < new Date(startedAt).getTime() + timeLimitSec * 1000;
}

/** Vaqt tugaganini (zaxira bilan) tekshiradi — javob qabul qilinadimi? */
function isExpired(startedAt, timeLimitSec, now = Date.now()) {
  if (!startedAt || !timeLimitSec) return false;
  return now > new Date(startedAt).getTime() + timeLimitSec * 1000 + GRACE_MS;
}

/** Talabaga yuboriladigan tugash vaqti (ISO) — front shundan hisob yuritadi. */
function endsAt(startedAt, timeLimitSec) {
  if (!startedAt || !timeLimitSec) return null;
  return new Date(new Date(startedAt).getTime() + timeLimitSec * 1000).toISOString();
}

module.exports = { isWindowOpen, isExpired, endsAt, GRACE_MS };
