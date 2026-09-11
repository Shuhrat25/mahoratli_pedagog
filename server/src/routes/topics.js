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
const { HttpError, route } = require("../lib/httpError");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { notifyAllStudents, TYPES } = require("../lib/notifications");

const router = express.Router();

const topicsInclude = {
  lessons: {
    orderBy: { order: "asc" },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
      materials: { include: { file: true }, orderBy: { order: "asc" } },
    },
  },
};

async function fetchLockedTopics(userId) {
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, include: topicsInclude });
  const progress = await prisma.lessonProgress.findMany({ where: { userId } });
  const progressByLessonId = new Map(progress.map((p) => [p.lessonId, p]));
  return computeLocks(topics, progressByLessonId);
}

function shapeMaterials(lesson) {
  return (lesson.materials || []).map((m) => ({ id: m.id, name: m.file.originalName, fileId: m.file.id }));
}

function shapeLessonForStudent(lesson) {
  const { questions, materials, ...rest } = lesson;
  const shaped = { ...rest, materials: shapeMaterials(lesson) };

  // Qulflangan dars mazmuni umuman yuborilmaydi — ilgari u javobda qolib,
  // faqat interfeys darajasida yashirilardi (DevTools orqali ko'rish mumkin edi).
  if (lesson.locked) {
    return {
      id: lesson.id,
      topicId: lesson.topicId,
      title: lesson.title,
      type: lesson.type,
      order: lesson.order,
      locked: true,
      done: false,
      startsAt: lesson.startsAt,
      questionCount: questions?.length || 0,
      materials: [],
    };
  }

  if (lesson.type === "TEST") {
    const list = questions.map((q) => ({
      id: q.id,
      text: q.text,
      // Bir nechta to'g'ri javob bo'lsa, talaba interfeysida checkbox chiziladi.
      multiple: q.options.filter((o) => o.correct).length > 1,
      options: q.options.map((o) => ({ id: o.id, text: o.text })), // to'g'ri javob yashiriladi
    }));
    shaped.questions = lesson.shuffle ? shuffle(list) : list;
  }
  return shaped;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

/** Talaba yuborgan javobni har doim massivga keltiradi (bir yoki bir nechta variant). */
function toChosenIds(answer) {
  if (Array.isArray(answer)) return answer.filter(Boolean);
  return answer ? [answer] : [];
}

/** Bir nechta to'g'ri javobli savol uchun: tanlangan to'plam to'g'ri to'plamga teng bo'lishi kerak. */
function gradeQuestion(question, answer) {
  const correctIds = question.options.filter((o) => o.correct).map((o) => o.id);
  const chosenIds = toChosenIds(answer);
  const isCorrect =
    correctIds.length > 0 &&
    chosenIds.length === correctIds.length &&
    correctIds.every((id) => chosenIds.includes(id));
  return { correctIds, chosenIds, isCorrect };
}

function lessonSettingsFromBody(body) {
  const data = {};
  if (body.meetingUrl !== undefined) data.meetingUrl = body.meetingUrl || null;
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.passScore !== undefined) {
    data.passScore = Math.max(0, Math.min(100, Number(body.passScore) || 0));
  }
  if (body.timeLimitSec !== undefined) {
    const value = Number(body.timeLimitSec);
    data.timeLimitSec = value > 0 ? Math.round(value) : null;
  }
  if (body.shuffle !== undefined) data.shuffle = !!body.shuffle;
  if (body.maxAttempts !== undefined) {
    const value = Number(body.maxAttempts);
    data.maxAttempts = value > 0 ? Math.round(value) : null;
  }
  return data;
}

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const locked = await fetchLockedTopics(req.user.id);
    const staff = isStaff(req.user);
    const topics = locked.map((t) => ({
      ...t,
      lessons: t.lessons.map((l) =>
        staff ? { ...l, materials: shapeMaterials(l) } : shapeLessonForStudent(l)
      ),
    }));
    res.json({ topics });
  })
);

// O'qituvchi uchun: qaysi talaba qaysi darsda turibdi (ТЗ tashqarisidagi
// qo'shimcha — ilgari LessonProgress yig'ilardi, lekin hech qayerda ko'rinmasdi).
router.get(
  "/progress",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const [topics, students, progress] = await Promise.all([
      prisma.topic.findMany({
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, type: true } } },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true, points: true },
      }),
      prisma.lessonProgress.findMany(),
    ]);

    const lessons = topics.flatMap((t) =>
      t.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, topicId: t.id, topicTitle: t.title }))
    );
    const byUser = new Map();
    progress.forEach((p) => {
      if (!byUser.has(p.userId)) byUser.set(p.userId, new Map());
      byUser.get(p.userId).set(p.lessonId, p);
    });

    const rows = students.map((student) => {
      const mine = byUser.get(student.id) || new Map();
      const cells = lessons.map((l) => {
        const p = mine.get(l.id);
        return { lessonId: l.id, done: !!p?.completed, score: p?.score ?? null, attempts: p?.attempts ?? 0 };
      });
      const doneCount = cells.filter((c) => c.done).length;
      const testScores = cells.filter((c) => c.score != null).map((c) => c.score);
      return {
        student,
        cells,
        doneCount,
        percent: lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0,
        averageScore: testScores.length
          ? Math.round(testScores.reduce((s, v) => s + v, 0) / testScores.length)
          : null,
        // Qayerda to'xtab qolgan — birinchi bajarilmagan dars.
        currentLesson: lessons.find((l) => !mine.get(l.id)?.completed) || null,
      };
    });

    res.json({ lessons, rows });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title } = req.body;
    if (!title) throw new HttpError(400, "Mavzu nomi talab qilinadi");
    const count = await prisma.topic.count();
    const topic = await prisma.topic.create({ data: { title, order: count }, include: topicsInclude });
    res.status(201).json({ topic });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title } = req.body;
    const topic = await prisma.topic.update({
      where: { id: req.params.id },
      data: { title },
      include: topicsInclude,
    });
    res.json({ topic });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.topic.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.patch(
  "/:id/move",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { direction } = req.body;
    const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
    const idx = topics.findIndex((t) => t.id === req.params.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= topics.length) {
      throw new HttpError(400, "Ko'chirib bo'lmaydi");
    }
    await prisma.$transaction([
      prisma.topic.update({ where: { id: topics[idx].id }, data: { order: topics[swapIdx].order } }),
      prisma.topic.update({ where: { id: topics[swapIdx].id }, data: { order: topics[idx].order } }),
    ]);
    res.json({ ok: true });
  })
);

router.post(
  "/:topicId/lessons",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title, type, videoUrl, content, questions } = req.body;
    if (!title || !LESSON_TYPES.includes(type)) throw new HttpError(400, "Nomi va turi talab qilinadi");
    if (type === "LIVE" && !req.body.meetingUrl) {
      throw new HttpError(400, "Jonli dars uchun uchrashuv havolasi talab qilinadi");
    }

    const count = await prisma.lesson.count({ where: { topicId: req.params.topicId } });
    const lesson = await prisma.lesson.create({
      data: {
        topicId: req.params.topicId,
        title,
        type,
        videoUrl: videoUrl || null,
        content: content ? sanitizeHtml(content) : null,
        order: count,
        ...lessonSettingsFromBody(req.body),
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
      include: { questions: { include: { options: true } }, topic: true },
    });

    if (lesson.type === "LIVE") {
      await notifyAllStudents({
        type: TYPES.LESSON_LIVE,
        title: "Jonli dars rejalashtirildi",
        body: `${lesson.topic.title} — ${lesson.title}`,
        link: `/student/lessons/${lesson.topicId}/${lesson.id}`,
      });
    }

    res.status(201).json({ lesson });
  })
);

router.patch(
  "/:topicId/lessons/:lessonId",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title, videoUrl, content } = req.body;
    const data = { ...lessonSettingsFromBody(req.body) };
    if (title !== undefined) data.title = title;
    if (videoUrl !== undefined) data.videoUrl = videoUrl;
    if (content !== undefined) data.content = content ? sanitizeHtml(content) : null;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data,
      include: { questions: { include: { options: true } } },
    });
    res.json({ lesson });
  })
);

router.delete(
  "/:topicId/lessons/:lessonId",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.lesson.delete({ where: { id: req.params.lessonId } });
    res.json({ ok: true });
  })
);

router.patch(
  "/:topicId/lessons/:lessonId/move",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { direction } = req.body;
    const lessons = await prisma.lesson.findMany({ where: { topicId: req.params.topicId }, orderBy: { order: "asc" } });
    const idx = lessons.findIndex((l) => l.id === req.params.lessonId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= lessons.length) throw new HttpError(400, "Ko'chirib bo'lmaydi");
    await prisma.$transaction([
      prisma.lesson.update({ where: { id: lessons[idx].id }, data: { order: lessons[swapIdx].order } }),
      prisma.lesson.update({ where: { id: lessons[swapIdx].id }, data: { order: lessons[idx].order } }),
    ]);
    res.json({ ok: true });
  })
);

// Darsga biriktirilgan fayllar (taqdimot, PDF, ish daftari...)
router.post(
  "/:topicId/lessons/:lessonId/materials",
  requireRole("ADMIN", "TEACHER"),
  upload.array("files", 20),
  route(async (req, res) => {
    if (!req.files || req.files.length === 0) throw new HttpError(400, "Fayl talab qilinadi");
    const count = await prisma.lessonMaterial.count({ where: { lessonId: req.params.lessonId } });
    for (let i = 0; i < req.files.length; i++) {
      const file = await createUploadedFileRecord(req.files[i], req.user.id);
      await prisma.lessonMaterial.create({
        data: { lessonId: req.params.lessonId, fileId: file.id, order: count + i },
      });
    }
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: { materials: { include: { file: true }, orderBy: { order: "asc" } } },
    });
    res.status(201).json({ materials: shapeMaterials(lesson) });
  })
);

router.delete(
  "/:topicId/lessons/:lessonId/materials/:materialId",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.lessonMaterial.delete({ where: { id: req.params.materialId } });
    res.json({ ok: true });
  })
);

// ТЗ §6.5: test butun fayl (DOCX/PDF) sifatida ~ / == / ++++ formatida yuklanadi
router.post(
  "/:topicId/lessons/:lessonId/import-test",
  requireRole("ADMIN", "TEACHER"),
  upload.single("file"),
  route(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Fayl talab qilinadi");
    try {
      const text = await extractText(req.file.path);
      const parsed = parseTestMarkup(text);
      if (parsed.length === 0) throw new HttpError(400, "Faylda tanilgan savol topilmadi");

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
  })
);

router.post(
  "/:topicId/lessons/:lessonId/complete",
  requireAuth,
  route(async (req, res) => {
    const locked = await fetchLockedTopics(req.user.id);
    const topic = locked.find((t) => t.id === req.params.topicId);
    const lesson = topic?.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) throw new HttpError(404, "Dars topilmadi");
    if (lesson.locked) throw new HttpError(403, "Bu dars hali qulflangan");
    // Test darsi faqat testni topshirish orqali yopiladi, aks holda uni
    // shunchaki "tugatildi" deb belgilab, o'tib ketish mumkin edi.
    if (lesson.type === "TEST") {
      throw new HttpError(400, "Test darsi testni yakunlash orqali tugatiladi");
    }

    const progress = await prisma.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId: lesson.id, userId: req.user.id } },
      update: { completed: true, completedAt: new Date() },
      create: { lessonId: lesson.id, userId: req.user.id, completed: true, completedAt: new Date() },
    });
    res.json({ progress });
  })
);

router.post(
  "/:topicId/lessons/:lessonId/submit-test",
  requireAuth,
  route(async (req, res) => {
    const { answers } = req.body; // { questionId: optionId | [optionId, ...] }
    const locked = await fetchLockedTopics(req.user.id);
    const topic = locked.find((t) => t.id === req.params.topicId);
    const lesson = topic?.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) throw new HttpError(404, "Dars topilmadi");
    if (lesson.locked) throw new HttpError(403, "Bu dars hali qulflangan");

    const full = await prisma.lesson.findUnique({
      where: { id: lesson.id },
      include: { questions: { include: { options: true } } },
    });

    const existing = await prisma.lessonProgress.findUnique({
      where: { lessonId_userId: { lessonId: lesson.id, userId: req.user.id } },
    });
    const usedAttempts = existing?.attempts || 0;
    if (full.maxAttempts && usedAttempts >= full.maxAttempts) {
      throw new HttpError(403, `Urinishlar tugadi (${full.maxAttempts} tadan ${usedAttempts} ta ishlatilgan)`);
    }

    let correctCount = 0;
    const results = full.questions.map((q) => {
      const { correctIds, chosenIds, isCorrect } = gradeQuestion(q, answers?.[q.id]);
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        correctOptionIds: correctIds,
        chosenOptionIds: chosenIds,
        isCorrect,
      };
    });

    const total = full.questions.length;
    const score = total ? Math.round((correctCount / total) * 100) : 0;
    const passed = score >= (full.passScore ?? 60);
    const attempts = usedAttempts + 1;

    // Dars faqat o'tish balli olinganda yopiladi — ilgari 0% bilan ham
    // keyingi dars ochilib ketardi.
    await prisma.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId: lesson.id, userId: req.user.id } },
      update: {
        attempts,
        score: Math.max(score, existing?.score ?? 0),
        completed: existing?.completed || passed,
        completedAt: existing?.completed ? existing.completedAt : passed ? new Date() : null,
      },
      create: {
        lessonId: lesson.id,
        userId: req.user.id,
        attempts,
        score,
        completed: passed,
        completedAt: passed ? new Date() : null,
      },
    });

    res.json({
      correctCount,
      total,
      score,
      passScore: full.passScore ?? 60,
      passed,
      attempts,
      maxAttempts: full.maxAttempts,
      results,
    });
  })
);

module.exports = router;
