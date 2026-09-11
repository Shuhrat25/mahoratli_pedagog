const prisma = require("../db");
const { sendToUser } = require("../ws");

// Ichki bildirishnomalar: bazaga yoziladi (qo'ng'iroqcha ro'yxati uchun) va
// agar foydalanuvchining ochiq tabi bo'lsa — WebSocket orqali darhol yetkaziladi.

const TYPES = {
  ASSIGNMENT_NEW: "ASSIGNMENT_NEW",
  ASSIGNMENT_GRADED: "ASSIGNMENT_GRADED",
  ASSIGNMENT_DUE_SOON: "ASSIGNMENT_DUE_SOON",
  FORUM_REPLY: "FORUM_REPLY",
  POST_NEW: "POST_NEW",
  LESSON_LIVE: "LESSON_LIVE",
  SUBMISSION_NEW: "SUBMISSION_NEW",
};

async function notify(userId, { type, title, body, link }) {
  if (!userId) return null;
  const notification = await prisma.notification.create({
    data: { userId, type, title, body: body || null, link: link || null },
  });
  sendToUser(userId, { type: "notification", notification });
  return notification;
}

/** Bir nechta foydalanuvchiga bir xil bildirishnoma (masalan barcha talabalarga). */
async function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body || null,
      link: payload.link || null,
    })),
  });
  // createMany yaratilgan yozuvlarni qaytarmaydi, shuning uchun WS orqali
  // "yangilan" signalini yuboramiz — front ro'yxatni qayta so'raydi.
  unique.forEach((userId) => sendToUser(userId, { type: "notifications-changed" }));
}

async function notifyAllStudents(payload) {
  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });
  await notifyMany(
    students.map((s) => s.id),
    payload
  );
}

async function notifyStaff(payload, { exceptUserId } = {}) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["TEACHER", "ADMIN"] } },
    select: { id: true },
  });
  await notifyMany(
    staff.map((s) => s.id).filter((id) => id !== exceptUserId),
    payload
  );
}

module.exports = { notify, notifyMany, notifyAllStudents, notifyStaff, TYPES };
