const prisma = require("../db");

// Onlayn holat.
//
// Ilgari bu faqat xotiradagi Map edi: server qayta ishga tushsa sanoq nolga
// tushardi, uzilib qolgan ulanishlar esa "close" hodisasi kelmagani uchun
// abadiy "onlayn" bo'lib qolardi.
//
// Endi ikki manba birlashtiriladi:
//  1) ochiq WebSocket ulanishlari (darhol, aniq) — ws.js ping/pong bilan
//     o'lik ulanishlarni uzib turadi;
//  2) User.lastSeenAt ustuni (qayta ishga tushirishdan omon qoladi).

const ONLINE_WINDOW_MS = 90 * 1000; // shu vaqt ichida ko'ringan = onlayn
const TOUCH_THROTTLE_MS = 30 * 1000; // bazaga har 30 soniyada bir marta yozamiz

const onlineCounts = new Map(); // userId -> ochiq ulanishlar soni
const lastTouched = new Map(); // userId -> oxirgi DB yozuvi vaqti

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function touch(userId) {
  const now = Date.now();
  if (now - (lastTouched.get(userId) || 0) < TOUCH_THROTTLE_MS) return;
  lastTouched.set(userId, now);
  prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch(() => {
      // Foydalanuvchi o'chirilgan bo'lishi mumkin — presence uchun muhim emas.
    });
  // Kunlik faollik — dashboarddagi tashriflar grafigi shu yozuvlardan quriladi.
  prisma.dailyActivity
    .upsert({
      where: { userId_day: { userId, day: today() } },
      update: {},
      create: { userId, day: today() },
    })
    .catch(() => {});
}

function markOnline(userId) {
  onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
  lastTouched.delete(userId); // birinchi ulanishda darhol yozilsin
  touch(userId);
}

function markOffline(userId) {
  const count = (onlineCounts.get(userId) || 1) - 1;
  if (count <= 0) {
    onlineCounts.delete(userId);
    lastTouched.delete(userId);
    // Chiqqan payt oxirgi ko'rilgan vaqt sifatida qayd etiladi.
    prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
  } else {
    onlineCounts.set(userId, count);
  }
}

function hasSocket(userId) {
  return onlineCounts.has(userId);
}

/** Foydalanuvchi yozuvi (lastSeenAt bilan) bo'yicha onlayn holati. */
function isOnline(user) {
  if (typeof user === "string") return hasSocket(user);
  if (!user) return false;
  if (hasSocket(user.id)) return true;
  return !!user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** Hozir onlayn foydalanuvchilar soni (bazadan — instans qayta ishga tushsa ham to'g'ri). */
async function onlineCount() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const fromDb = await prisma.user.count({ where: { lastSeenAt: { gte: since } } });
  // Ulanishi bor, lekin hali bazaga yozilmagan foydalanuvchilar ham bo'lishi
  // mumkin — shuning uchun kamida ochiq ulanishlar soni qaytariladi.
  return Math.max(fromDb, onlineCounts.size);
}

module.exports = { markOnline, markOffline, isOnline, onlineCount, touch, hasSocket, ONLINE_WINDOW_MS };
