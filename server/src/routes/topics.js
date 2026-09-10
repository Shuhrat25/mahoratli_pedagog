const express = require("express");
const fs = require("fs/promises");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { computeLocks } = require("../lib/lessonAccess");
const { extractText } = require("../lib/fileText");
const { parseTestMarkup } = require("../lib/testMarkup");
const { LESSON_TYPES } = require("../lib/constants");
const { sanitizeHtml } = require("../lib/sanitizeHtml");

const router = express.Router();

const topicsInclude = {
  lessons: { orderBy: { order: "asc" }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } },
};

async function fetchLockedTopics(userId) {
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, include: topicsInclude });
  const progress = await prisma.lessonProgress.findMany({ where: { userId } });
  const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]));
  return computeLocks(topics, progressByLessonId);
}

function shapeLessonForStudent(lesson) {
  const { questions, ...rest } = lesson;
  const shaped = { ...rest };
  if (lesson.type === "TEST") {
    shaped.questions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text })), // to'g'ri javob yashiriladi
    }));
  }
  return shaped;
}

router.get("/", requireAuth, async (req, res) => {
  const locked = await fetchLockedTopics(req.user.id);
  const isTeacher = req.user.role === "TEACHER" || req.user.role === "ADMIN";
  const topics = locked.map((t) => ({
    ...t,
    lessons: t.lessons.map((l) => (isTeacher ? l : shapeLessonForStudent(l))),
  }));
  res.json({ topics });
});

router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Mavzu nomi talab qilinadi" });
  const count = await prisma.topic.count();
  const topic = await prisma.topic.create({ data: { title, order: count }, include: topicsInclude });
  res.status(201).json({ topic });
});

router.patch("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title } = req.body;
  const topic = await prisma.topic.update({ where: { id: req.params.id }, data: { title }, include: topicsInclude });
  res.json({ topic });
});

router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.topic.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.patch("/:id/move", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { direction } = req.body;
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const idx = topics.findIndex((t) => t.id === req.params.id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= topics.length) return res.status(400).json({ error: "Ko'chirib bo'lmaydi" });
  await prisma.$transaction([
    prisma.topic.update({ where: { id: topics[idx].id }, data: { order: topics[swapIdx].order } }),
    prisma.topic.update({ where: { id: topics[swapIdx].id }, data: { order: topics[idx].order } }),
  ]);
  res.json({ ok: true });
});

router.post("/:topicId/lessons", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title, type, videoUrl, content, questions } = req.body;
  if (!title || !LESSON_TYPES.includes(type)) return res.status(400).json({ error: "Nomi va turi talab qilinadi" });

  const count = await prisma.lesson.count({ where: { topicId: req.params.topicId } });
  const lesson = await prisma.lesson.create({
    data: {
      topicId: req.params.topicId,
      title,
      type,
      videoUrl: videoUrl || null,
      content: content ? sanitizeHtml(content) : null,
      order: count,
      questions:
        type === "TEST" && Array.isArray(questions)
          ? {
              create: questions.map((q, qi) => ({
                text: q.text,
                order: qi,
                options: { create: q.options.map((o, oi) => ({ text: o.text, correct: !!o.correct, order: oi })) },
              })),
            }
          : undefined,
    },
    include: { questions: { include: { options: true } } },
  });
  res.status(201).json({ lesson });
});

router.patch("/:topicId/lessons/:lessonId", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title, videoUrl, content } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (videoUrl !== undefined) data.videoUrl = videoUrl;
  if (content !== undefined) data.content = content ? sanitizeHtml(content) : null;
  const lesson = await prisma.lesson.update({
    where: { id: req.params.lessonId },
    data,
    include: { questions: { include: { options: true } } },
  });
  res.json({ lesson });
});

router.delete("/:topicId/lessons/:lessonId", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.lesson.delete({ where: { id: req.params.lessonId } });
  res.json({ ok: true });
});

router.patch("/:topicId/lessons/:lessonId/move", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { direction } = req.body;
  const lessons = await prisma.lesson.findMany({ where: { topicId: req.params.topicId }, orderBy: { order: "asc" } });
  const idx = lessons.findIndex((l) => l.id === req.params.lessonId);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= lessons.length) return res.status(400).json({ error: "Ko'chirib bo'lmaydi" });
  await prisma.$transaction([
    prisma.lesson.update({ where: { id: lessons[idx].id }, data: { order: lessons[swapIdx].order } }),
    prisma.lesson.update({ where: { id: lessons[swapIdx].id }, data: { order: lessons[idx].order } }),
  ]);
  res.json({ ok: true });
});

// ТЗ §6.5: test butun fayl (DOCX/PDF) sifatida ~ / == / ++++ formatida yuklanadi
router.post(
  "/:topicId/lessons/:lessonId/import-test",
  requireRole("ADMIN", "TEACHER"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fayl talab qilinadi" });
    try {
      const text = await extractText(req.file.path);
      const parsed = parseTestMarkup(text);
      if (parsed.length === 0) return res.status(400).json({ error: "Faylda tanilgan savol topilmadi" });

      await prisma.question.deleteMany({ where: { lessonId: req.params.lessonId } });
      for (let qi = 0; qi < parsed.length; qi++) {
        const q = parsed[qi];
        await prisma.question.create({
          data: {
            lessonId: req.params.lessonId,
            text: q.text,
            order: qi,
            options: { create: q.options.map((o, oi) => ({ text: o.text, correct: o.correct, order: oi })) },
          },
        });
      }
      const lesson = await prisma.lesson.findUnique({
        where: { id: req.params.lessonId },
        include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
      });
      res.json({ lesson, questionCount: parsed.length });
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
);

router.post("/:topicId/lessons/:lessonId/complete", requireAuth, async (req, res) => {
  const locked = await fetchLockedTopics(req.user.id);
  const topic = locked.find((t) => t.id === req.params.topicId);
  const lesson = topic?.lessons.find((l) => l.id === req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: "Dars topilmadi" });
  if (lesson.locked) return res.status(403).json({ error: "Bu dars hali qulflangan" });

  const progress = await prisma.lessonProgress.upsert({
    where: { lessonId_userId: { lessonId: lesson.id, userId: req.user.id } },
    update: { completed: true, completedAt: new Date() },
    create: { lessonId: lesson.id, userId: req.user.id, completed: true, completedAt: new Date() },
  });
  res.json({ progress });
});

router.post("/:topicId/lessons/:lessonId/submit-test", requireAuth, async (req, res) => {
  const { answers } = req.body; // { questionId: optionId }
  const locked = await fetchLockedTopics(req.user.id);
  const topic = locked.find((t) => t.id === req.params.topicId);
  const lesson = topic?.lessons.find((l) => l.id === req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: "Dars topilmadi" });
  if (lesson.locked) return res.status(403).json({ error: "Bu dars hali qulflangan" });

  const full = await prisma.lesson.findUnique({
    where: { id: lesson.id },
    include: { questions: { include: { options: true } } },
  });
  let correctCount = 0;
  const results = full.questions.map((q) => {
    const chosenId = answers?.[q.id];
    const correctOption = q.options.find((o) => o.correct);
    const isCorrect = chosenId === correctOption?.id;
    if (isCorrect) correctCount++;
    return { questionId: q.id, correctOptionId: correctOption?.id, chosenOptionId: chosenId, isCorrect };
  });
  const score = full.questions.length ? Math.round((correctCount / full.questions.length) * 100) : 0;

  await prisma.lessonProgress.upsert({
    where: { lessonId_userId: { lessonId: lesson.id, userId: req.user.id } },
    update: { completed: true, completedAt: new Date(), score },
    create: { lessonId: lesson.id, userId: req.user.id, completed: true, completedAt: new Date(), score },
  });

  res.json({ correctCount, total: full.questions.length, score, results });
});

module.exports = router;
