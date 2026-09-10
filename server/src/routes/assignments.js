const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { extractText } = require("../lib/fileText");
const { parseTestMarkup } = require("../lib/testMarkup");

const router = express.Router();

const detailInclude = {
  steps: { orderBy: { order: "asc" } },
  materials: { include: { file: true } },
  questions: { include: { options: true }, orderBy: { order: "asc" } },
  submissions: { include: { student: true, file: true } },
};

function shapeAssignment(a, user) {
  const isStaff = user.role === "TEACHER" || user.role === "ADMIN";
  const mySubmission = a.submissions.find((s) => s.studentId === user.id);
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    maxScore: a.maxScore,
    dueDate: a.dueDate,
    steps: a.steps,
    materials: a.materials.map((m) => ({ id: m.id, name: m.file.originalName, fileId: m.file.id })),
    // Talabaga to'g'ri javob ko'rsatilmaydi — darslardagi TEST bilan bir xil
    // mantiq (topics.js#shapeLessonForStudent'ga qarang).
    questions: a.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => (isStaff ? { id: o.id, text: o.text, correct: o.correct } : { id: o.id, text: o.text })),
    })),
    submissions: isStaff
      ? a.submissions.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          studentName: `${s.student.firstName} ${s.student.lastName}`,
          fileName: s.file?.originalName,
          fileId: s.file?.id,
          submittedAt: s.submittedAt,
          score: s.score,
          comment: s.comment,
          status: s.status,
        }))
      : mySubmission
      ? [
          {
            id: mySubmission.id,
            studentId: mySubmission.studentId,
            fileName: mySubmission.file?.originalName,
            submittedAt: mySubmission.submittedAt,
            score: mySubmission.score,
            comment: mySubmission.comment,
            status: mySubmission.status,
          },
        ]
      : [],
  };
}

router.get("/", requireAuth, async (req, res) => {
  const assignments = await prisma.assignment.findMany({ include: detailInclude, orderBy: { dueDate: "asc" } });
  res.json({ assignments: assignments.map((a) => shapeAssignment(a, req.user)) });
});

router.get("/:id", requireAuth, async (req, res) => {
  const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
  if (!a) return res.status(404).json({ error: "Vazifa topilmadi" });
  res.json({ assignment: shapeAssignment(a, req.user) });
});

router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title, description, type, maxScore, dueDate, steps } = req.body;
  const assignmentType = type === "TEST" ? "TEST" : "FILE";
  if (!title || !maxScore || !dueDate) return res.status(400).json({ error: "Nomi, ball va muddat talab qilinadi" });
  // TEST turida savollar keyingi qadamda (fayl import qilinganda) qo'shiladi,
  // shuning uchun tavsif/qadam talabi faqat FILE turiga tegishli.
  if (assignmentType === "FILE" && !description && !(Array.isArray(steps) && steps.length)) {
    return res.status(400).json({ error: "Tavsif yoki qadamlardan kamida bittasi to'ldirilishi shart" });
  }
  const a = await prisma.assignment.create({
    data: {
      title,
      description: description || "",
      type: assignmentType,
      maxScore: Number(maxScore),
      dueDate: new Date(dueDate),
      steps:
        assignmentType === "FILE" && Array.isArray(steps)
          ? { create: steps.map((s, i) => ({ title: s.title, text: s.text, order: i })) }
          : undefined,
    },
    include: detailInclude,
  });
  res.status(201).json({ assignment: shapeAssignment(a, req.user) });
});

router.patch("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { title, description, maxScore, dueDate } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (maxScore !== undefined) data.maxScore = Number(maxScore);
  if (dueDate !== undefined) data.dueDate = new Date(dueDate);
  const a = await prisma.assignment.update({ where: { id: req.params.id }, data, include: detailInclude });
  res.json({ assignment: shapeAssignment(a, req.user) });
});

router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.assignment.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/materials", requireRole("ADMIN", "TEACHER"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Fayl talab qilinadi" });
  const file = await createUploadedFileRecord(req.file, req.user.id);
  await prisma.assignmentMaterial.create({ data: { assignmentId: req.params.id, fileId: file.id } });
  const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
  res.status(201).json({ assignment: shapeAssignment(a, req.user) });
});

router.delete("/:id/materials/:materialId", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.assignmentMaterial.delete({ where: { id: req.params.materialId } });
  res.json({ ok: true });
});

router.post(
  "/:id/import-test",
  requireRole("ADMIN", "TEACHER"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fayl talab qilinadi" });
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ error: "Vazifa topilmadi" });
    if (assignment.type !== "TEST") return res.status(400).json({ error: "Bu vazifa TEST turida emas" });
    try {
      const text = await extractText(req.file.path);
      const parsed = parseTestMarkup(text);
      if (parsed.length === 0) return res.status(400).json({ error: "Faylda tanilgan savol topilmadi" });

      await prisma.assignmentQuestion.deleteMany({ where: { assignmentId: req.params.id } });
      for (let qi = 0; qi < parsed.length; qi++) {
        const q = parsed[qi];
        await prisma.assignmentQuestion.create({
          data: {
            assignmentId: req.params.id,
            text: q.text,
            order: qi,
            options: { create: q.options.map((o, oi) => ({ text: o.text, correct: o.correct, order: oi })) },
          },
        });
      }
      const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
      res.status(201).json({ assignment: shapeAssignment(a, req.user) });
    } catch (err) {
      res.status(400).json({ error: err.message || "Faylni o'qib bo'lmadi" });
    }
  }
);

router.post("/:id/submit-test", requireRole("STUDENT"), async (req, res) => {
  const { answers } = req.body; // { questionId: optionId }
  const assignment = await prisma.assignment.findUnique({
    where: { id: req.params.id },
    include: { questions: { include: { options: true } } },
  });
  if (!assignment) return res.status(404).json({ error: "Vazifa topilmadi" });
  if (assignment.type !== "TEST") return res.status(400).json({ error: "Bu vazifa TEST turida emas" });
  if (new Date(assignment.dueDate) < new Date()) return res.status(403).json({ error: "Vazifa muddati yopilgan" });

  let correctCount = 0;
  const results = assignment.questions.map((q) => {
    const chosenId = answers?.[q.id];
    const correctOption = q.options.find((o) => o.correct);
    const isCorrect = chosenId === correctOption?.id;
    if (isCorrect) correctCount++;
    return { questionId: q.id, correctOptionId: correctOption?.id, chosenOptionId: chosenId, isCorrect };
  });
  const total = assignment.questions.length;
  const score = total ? Math.round((correctCount / total) * assignment.maxScore) : 0;

  const previous = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
  });
  await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
    update: { fileId: null, submittedAt: new Date(), score, comment: null, status: "REVIEWED" },
    create: { assignmentId: req.params.id, studentId: req.user.id, score, status: "REVIEWED" },
  });

  // Qayta topshirilganda ball farqi qo'shiladi (birinchi marta esa to'liq ball).
  const pointsDelta = previous?.status === "REVIEWED" ? score - (previous.score || 0) : score;
  if (pointsDelta !== 0) {
    await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: pointsDelta } } });
  }

  res.json({ correctCount, total, score, maxScore: assignment.maxScore, results });
});

router.post("/:id/submit", requireRole("STUDENT"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Fayl talab qilinadi" });
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) return res.status(404).json({ error: "Vazifa topilmadi" });
  if (assignment.type === "TEST") return res.status(400).json({ error: "Bu vazifa TEST turida — fayl emas, javoblar yuboriladi" });
  if (new Date(assignment.dueDate) < new Date()) return res.status(403).json({ error: "Vazifa muddati yopilgan" });

  const file = await createUploadedFileRecord(req.file, req.user.id);
  const submission = await prisma.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
    update: { fileId: file.id, submittedAt: new Date(), score: null, comment: null, status: "NOT_REVIEWED" },
    create: { assignmentId: req.params.id, studentId: req.user.id, fileId: file.id },
  });
  res.status(201).json({ submission });
});

router.patch("/:id/submissions/:subId", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { score, comment } = req.body;
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) return res.status(404).json({ error: "Vazifa topilmadi" });
  const clampedScore = Math.max(0, Math.min(Number(score), assignment.maxScore));

  const previous = await prisma.submission.findUnique({ where: { id: req.params.subId } });
  const submission = await prisma.submission.update({
    where: { id: req.params.subId },
    data: { score: clampedScore, comment: comment || null, status: "REVIEWED" },
  });

  // Talaba ballari umumiy reyting uchun User.points ga qo'shiladi (faqat
  // qayta baholanmagan holatda — regrade ball qo'shmaydi, farqini qo'shadi)
  const pointsDelta = previous.status === "REVIEWED" ? clampedScore - (previous.score || 0) : clampedScore;
  if (pointsDelta !== 0) {
    await prisma.user.update({
      where: { id: submission.studentId },
      data: { points: { increment: pointsDelta } },
    });
  }

  const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
  res.json({ assignment: shapeAssignment(a, req.user) });
});

module.exports = router;
