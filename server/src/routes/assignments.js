const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");

const router = express.Router();

const detailInclude = {
  steps: { orderBy: { order: "asc" } },
  materials: { include: { file: true } },
  submissions: { include: { student: true, file: true } },
};

function shapeAssignment(a, user) {
  const isStaff = user.role === "TEACHER" || user.role === "ADMIN";
  const mySubmission = a.submissions.find((s) => s.studentId === user.id);
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    maxScore: a.maxScore,
    dueDate: a.dueDate,
    steps: a.steps,
    materials: a.materials.map((m) => ({ id: m.id, name: m.file.originalName, fileId: m.file.id })),
    submissions: isStaff
      ? a.submissions.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          studentName: `${s.student.firstName} ${s.student.lastName}`,
          fileName: s.file.originalName,
          fileId: s.file.id,
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
            fileName: mySubmission.file.originalName,
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
  const { title, description, maxScore, dueDate, steps } = req.body;
  if (!title || !maxScore || !dueDate) return res.status(400).json({ error: "Nomi, ball va muddat talab qilinadi" });
  if (!description && !(Array.isArray(steps) && steps.length)) {
    return res.status(400).json({ error: "Tavsif yoki qadamlardan kamida bittasi to'ldirilishi shart" });
  }
  const a = await prisma.assignment.create({
    data: {
      title,
      description: description || "",
      maxScore: Number(maxScore),
      dueDate: new Date(dueDate),
      steps: Array.isArray(steps) ? { create: steps.map((s, i) => ({ title: s.title, text: s.text, order: i })) } : undefined,
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

router.post("/:id/submit", requireRole("STUDENT"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Fayl talab qilinadi" });
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) return res.status(404).json({ error: "Vazifa topilmadi" });
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
