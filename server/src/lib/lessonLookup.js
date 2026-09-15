const prisma = require("../db");
const { computeLocks } = require("./lessonAccess");

const topicsInclude = {
  lessons: {
    orderBy: { order: "asc" },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
      materials: { include: { file: true }, orderBy: { order: "asc" } },
      puzzleImages: { include: { file: true }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  },
};

/** Barcha mavzular — shu foydalanuvchi uchun qulf holati bilan. */
async function fetchLockedTopics(userId) {
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, include: topicsInclude });
  const progress = await prisma.lessonProgress.findMany({ where: { userId } });
  const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]));
  return computeLocks(topics, progressByLessonId);
}

/** Darsni id bo'yicha topadi (mavzusi bilan birga) — qulf holati hisoblangan. */
async function findLockedLesson(userId, lessonId) {
  const topics = await fetchLockedTopics(userId);
  for (const topic of topics) {
    const lesson = topic.lessons.find((l) => l.id === lessonId);
    if (lesson) return { topic, lesson };
  }
  return null;
}

module.exports = { topicsInclude, fetchLockedTopics, findLockedLesson };
