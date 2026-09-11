const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { extractText } = require("../lib/fileText");
const { parseTestMarkup } = require("../lib/testMarkup");
const { sanitizeHtml, isEmptyHtml } = require("../lib/sanitizeHtml");
const { HttpError, route } = require("../lib/httpError");
const { toCsv } = require("../lib/csv");
const { notify, notifyAllStudents, notifyStaff, TYPES } = require("../lib/notifications");

const router = express.Router();

const detailInclude = {
  steps: { orderBy: { order: "asc" } },
  materials: { include: { file: true } },
  questions: { include: { options: true }, orderBy: { order: "asc" } },
  submissions: {
    include: {
      student: true,
      file: true,
      files: { include: { file: true }, orderBy: { order: "asc" } },
    },
  },
};

function isStaffUser(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

function shapeSubmissionFiles(s) {
  // Eski javoblarda faqat `fileId` bor edi — ular ham ro'yxat sifatida qaytadi.
  if (s.files?.length) {
    return s.files.map((f) => ({ id: f.id, name: f.file.originalName, fileId: f.file.id }));
  }
  return s.file ? [{ id: s.file.id, name: s.file.originalName, fileId: s.file.id }] : [];
}

function shapeAssignment(a, user) {
  const isStaff = isStaffUser(user);
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
      multiple: q.options.filter((o) => o.correct).length > 1,
      options: q.options.map((o) => (isStaff ? { id: o.id, text: o.text, correct: o.correct } : { id: o.id, text: o.text })),
    })),
    submissions: isStaff
      ? a.submissions.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          studentName: `${s.student.firstName} ${s.student.lastName}`,
          fileName: s.file?.originalName,
          fileId: s.file?.id,
          files: shapeSubmissionFiles(s),
          text: s.text,
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
            files: shapeSubmissionFiles(mySubmission),
            text: mySubmission.text,
            submittedAt: mySubmission.submittedAt,
            score: mySubmission.score,
            comment: mySubmission.comment,
            status: mySubmission.status,
          },
        ]
      : [],
  };
}

function toChosenIds(answer) {
  if (Array.isArray(answer)) return answer.filter(Boolean);
  return answer ? [answer] : [];
}

/** Bir nechta to'g'ri javobli savol: tanlangan to'plam to'g'ri to'plamga teng bo'lishi kerak. */
function gradeQuestion(question, answer) {
  const correctIds = question.options.filter((o) => o.correct).map((o) => o.id);
  const chosenIds = toChosenIds(answer);
  const isCorrect =
    correctIds.length > 0 &&
    chosenIds.length === correctIds.length &&
    correctIds.every((id) => chosenIds.includes(id));
  return { correctIds, chosenIds, isCorrect };
}

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const assignments = await prisma.assignment.findMany({ include: detailInclude, orderBy: { dueDate: "asc" } });
    res.json({ assignments: assignments.map((a) => shapeAssignment(a, req.user)) });
  })
);

// Baholarni jadval sifatida yuklab olish. CSV — Excel uni to'g'ridan-to'g'ri
// ochadi; BOM qo'shilgani uchun kirill/lotin harflari buzilmaydi.
router.get(
  "/export.csv",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const [students, assignments] = await Promise.all([
      prisma.user.findMany({
        where: { role: "STUDENT" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true, university: true, points: true },
      }),
      prisma.assignment.findMany({
        orderBy: { dueDate: "asc" },
        include: { submissions: true },
      }),
    ]);

    const header = [
      "Familiya",
      "Ism",
      "Pochta",
      "Universitet",
      ...assignments.map((a) => `${a.title} (max ${a.maxScore})`),
      "Jami ball",
    ];

    const rows = students.map((s) => {
      const cells = assignments.map((a) => {
        const sub = a.submissions.find((x) => x.studentId === s.id);
        if (!sub) return "";
        if (sub.status !== "REVIEWED" || sub.score == null) return "tekshirilmagan";
        return String(sub.score);
      });
      return [s.lastName, s.firstName, s.email, s.university || "", ...cells, String(s.points)];
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="baholar-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv([header, ...rows]));
  })
);

router.get(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
    if (!a) throw new HttpError(404, "Vazifa topilmadi");
    res.json({ assignment: shapeAssignment(a, req.user) });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title, description, type, maxScore, dueDate, steps } = req.body;
    const assignmentType = type === "TEST" ? "TEST" : "FILE";
    const cleanDescription = isEmptyHtml(description) ? "" : sanitizeHtml(description);
    if (!title || !maxScore || !dueDate) throw new HttpError(400, "Nomi, ball va muddat talab qilinadi");
    // TEST turida savollar keyingi qadamda (fayl import qilinganda) qo'shiladi,
    // shuning uchun tavsif/qadam talabi faqat FILE turiga tegishli.
    if (assignmentType === "FILE" && !cleanDescription && !(Array.isArray(steps) && steps.length)) {
      throw new HttpError(400, "Tavsif yoki qadamlardan kamida bittasi to'ldirilishi shart");
    }
    const a = await prisma.assignment.create({
      data: {
        title,
        description: cleanDescription,
        type: assignmentType,
        maxScore: Number(maxScore),
        dueDate: new Date(dueDate),
        steps:
          assignmentType === "FILE" && Array.isArray(steps)
            ? { create: steps.map((s, i) => ({ title: s.title, text: sanitizeHtml(s.text), order: i })) }
            : undefined,
      },
      include: detailInclude,
    });

    await notifyAllStudents({
      type: TYPES.ASSIGNMENT_NEW,
      title: "Yangi vazifa",
      body: `${a.title} — muddat: ${new Date(a.dueDate).toLocaleString("uz-UZ")}`,
      link: `/student/assignments/${a.id}`,
    });

    res.status(201).json({ assignment: shapeAssignment(a, req.user) });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { title, description, maxScore, dueDate } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = isEmptyHtml(description) ? "" : sanitizeHtml(description);
    if (maxScore !== undefined) data.maxScore = Number(maxScore);
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    const a = await prisma.assignment.update({ where: { id: req.params.id }, data, include: detailInclude });
    res.json({ assignment: shapeAssignment(a, req.user) });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/materials",
  requireRole("ADMIN", "TEACHER"),
  upload.single("file"),
  route(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Fayl talab qilinadi");
    const file = await createUploadedFileRecord(req.file, req.user.id);
    await prisma.assignmentMaterial.create({ data: { assignmentId: req.params.id, fileId: file.id } });
    const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
    if (!a) throw new HttpError(404, "Vazifa topilmadi");
    res.status(201).json({ assignment: shapeAssignment(a, req.user) });
  })
);

router.delete(
  "/:id/materials/:materialId",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.assignmentMaterial.delete({ where: { id: req.params.materialId } });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/import-test",
  requireRole("ADMIN", "TEACHER"),
  upload.single("file"),
  route(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Fayl talab qilinadi");
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type !== "TEST") throw new HttpError(400, "Bu vazifa TEST turida emas");

    const text = await extractText(req.file.path);
    const parsed = parseTestMarkup(text);
    if (parsed.length === 0) throw new HttpError(400, "Faylda tanilgan savol topilmadi");

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
  })
);

router.post(
  "/:id/submit-test",
  requireRole("STUDENT"),
  route(async (req, res) => {
    const { answers } = req.body; // { questionId: optionId | [optionId, ...] }
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { questions: { include: { options: true } } },
    });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type !== "TEST") throw new HttpError(400, "Bu vazifa TEST turida emas");
    if (new Date(assignment.dueDate) < new Date()) throw new HttpError(403, "Vazifa muddati yopilgan");

    let correctCount = 0;
    const results = assignment.questions.map((q) => {
      const { correctIds, chosenIds, isCorrect } = gradeQuestion(q, answers?.[q.id]);
      if (isCorrect) correctCount++;
      return { questionId: q.id, correctOptionIds: correctIds, chosenOptionIds: chosenIds, isCorrect };
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
  })
);

// Talaba ishni topshiradi: bir nechta fayl (10MB chegarasi HAR BIR faylga
// alohida tegishli, shuning uchun katta ishni bo'lib yuborish mumkin) va
// ixtiyoriy izoh.
router.post(
  "/:id/submit",
  requireRole("STUDENT"),
  upload.array("files", 10),
  route(async (req, res) => {
    const uploaded = req.files || [];
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (uploaded.length === 0) throw new HttpError(400, "Kamida bitta fayl tanlang");

    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type === "TEST") throw new HttpError(400, "Bu vazifa TEST turida — fayl emas, javoblar yuboriladi");
    if (new Date(assignment.dueDate) < new Date()) throw new HttpError(403, "Vazifa muddati yopilgan");

    const records = [];
    for (const f of uploaded) {
      records.push(await createUploadedFileRecord(f, req.user.id));
    }

    const submission = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
      // fileId birinchi faylga ishora qilib qoladi — eski yozuvlar bilan
      // moslik va fayl ruxsatlarini tekshirish shunga tayanadi.
      update: {
        fileId: records[0].id,
        text: text || null,
        submittedAt: new Date(),
        score: null,
        comment: null,
        status: "NOT_REVIEWED",
      },
      create: {
        assignmentId: req.params.id,
        studentId: req.user.id,
        fileId: records[0].id,
        text: text || null,
      },
    });

    // Qayta topshirilsa — oldingi fayllar ro'yxati almashtiriladi.
    await prisma.submissionFile.deleteMany({ where: { submissionId: submission.id } });
    await prisma.submissionFile.createMany({
      data: records.map((file, i) => ({ submissionId: submission.id, fileId: file.id, order: i })),
    });

    await notifyStaff({
      type: TYPES.SUBMISSION_NEW,
      title: "Yangi javob keldi",
      body: `${req.user.firstName} ${req.user.lastName} — ${assignment.title} (${records.length} ta fayl)`,
      link: `/teacher/assignments/${assignment.id}`,
    });

    const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
    res.status(201).json({ assignment: shapeAssignment(a, req.user) });
  })
);

router.patch(
  "/:id/submissions/:subId",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { score, comment } = req.body;
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");

    const previous = await prisma.submission.findUnique({ where: { id: req.params.subId } });
    if (!previous) throw new HttpError(404, "Javob topilmadi");

    const numericScore = Number(score);
    if (Number.isNaN(numericScore)) throw new HttpError(400, "Ball raqam bo'lishi kerak");
    const clampedScore = Math.max(0, Math.min(numericScore, assignment.maxScore));

    const submission = await prisma.submission.update({
      where: { id: req.params.subId },
      data: {
        score: clampedScore,
        comment: isEmptyHtml(comment) ? null : sanitizeHtml(comment),
        status: "REVIEWED",
      },
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

    await notify(submission.studentId, {
      type: TYPES.ASSIGNMENT_GRADED,
      title: "Ishingiz baholandi",
      body: `${assignment.title} — ${clampedScore}/${assignment.maxScore} ball`,
      link: `/student/assignments/${assignment.id}`,
    });

    const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: detailInclude });
    res.json({ assignment: shapeAssignment(a, req.user) });
  })
);

module.exports = router;
