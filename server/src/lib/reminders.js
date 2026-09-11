const prisma = require("../db");
const { notifyMany, TYPES } = require("./notifications");

// Muddati yaqinlashgan vazifalar haqida eslatma.
//
// Har soatda ishga tushadi va 24 soat ichida tugaydigan, hali topshirilmagan
// vazifalar bo'yicha talabalarga bir marta xabar yuboradi (takrorlanmasligi
// uchun shu vazifa bo'yicha ASSIGNMENT_DUE_SOON bildirishnomasi bor-yo'qligi
// tekshiriladi).

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

async function sendDueSoonReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + WINDOW_MS);

  const assignments = await prisma.assignment.findMany({
    where: { dueDate: { gt: now, lte: soon } },
    include: { submissions: { select: { studentId: true } } },
  });
  if (assignments.length === 0) return;

  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });

  for (const assignment of assignments) {
    const submitted = new Set(assignment.submissions.map((s) => s.studentId));
    const link = `/student/assignments/${assignment.id}`;

    // Shu vazifa bo'yicha eslatma allaqachon yuborilganlar.
    const alreadyNotified = await prisma.notification.findMany({
      where: { type: TYPES.ASSIGNMENT_DUE_SOON, link },
      select: { userId: true },
    });
    const notified = new Set(alreadyNotified.map((n) => n.userId));

    const targets = students.map((s) => s.id).filter((id) => !submitted.has(id) && !notified.has(id));
    if (targets.length === 0) continue;

    await notifyMany(targets, {
      type: TYPES.ASSIGNMENT_DUE_SOON,
      title: "Vazifa muddati yaqinlashdi",
      body: `${assignment.title} — ${new Date(assignment.dueDate).toLocaleString("uz-UZ")}`,
      link,
    });
  }
}

function startReminders() {
  const tick = () =>
    sendDueSoonReminders().catch((err) => console.error("[reminders] xatolik:", err.message));
  // Server ko'tarilgandan biroz keyin — migratsiya/ulanish tayyor bo'lishi uchun.
  const first = setTimeout(tick, 30 * 1000);
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  first.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

module.exports = { startReminders, sendDueSoonReminders };
