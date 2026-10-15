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
const { isWindowOpen, isExpired, endsAt } = require("../lib/testWindow");

const { userTransaction, auditGrade } = require('../lib/securityTransaction');
const { requireStartedAttempt } = require('../lib/testAttempt');
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
    timeLimitSec: a.timeLimitSec,
    maxAttempts: a.maxAttempts,
    steps: a.steps,
    materials: a.materials.map((m) => ({ id: m.id, name: m.file.originalName, fileId: m.file.id })),
    // Talabaga to'g'ri javob ko'rsatilmaydi — darslardagi TEST bilan bir xil
    // mantiq (topics.js#shapeLessonForStudent'ga qarang).
    questionCount: a.questions.length,
    questions: (isStaff || isWindowOpen(mySubmission?.testStartedAt, a.timeLimitSec) ? a.questions : []).map((q) => ({
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
          attempts: s.attempts,
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
            attempts: mySubmission.attempts,
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

/** Vazifa tanasidan TEST sozlamalarini ajratib oladi (bo'sh — cheklovsiz). */
function testSettingsFromBody(body) {
  const data = {};
  if (body.timeLimitSec !== undefined) {
    const value = Number(body.timeLimitSec);
    data.timeLimitSec = value > 0 ? Math.round(value) : null;
  }
  if (body.maxAttempts !== undefined) {
    const value = Number(body.maxAttempts);
    data.maxAttempts = value > 0 ? Math.round(value) : null;
  }
  return data;
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

router.get('/audit', requireRole('ADMIN', 'TEACHER'), route(async (req, res) => {
 const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
 const submissionIds = req.query.assignmentId ? (await prisma.submission.findMany({ where: { assignmentId: String(req.query.assignmentId) }, select: { id: true } })).map((s) => s.id) : [];
 const entries = await prisma.gradeAudit.findMany({ where: {
   ...(req.query.assignmentId ? { targetId: { in: [String(req.query.assignmentId), ...submissionIds] } } : {}),
   ...(req.query.studentId ? { studentId: String(req.query.studentId) } : {}),
   ...(req.query.targetId ? { targetId: String(req.query.targetId) } : {}),
 }, orderBy: { createdAt: 'desc' }, take: limit });
 const ids = [...new Set(entries.flatMap((entry) => [entry.actorId, entry.studentId]))];
 const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
 const names = new Map(people.map((person) => [person.id, person.firstName + ' ' + person.lastName]));
 res.json({ entries: entries.map((entry) => ({ ...entry, actorName: names.get(entry.actorId) || entry.actorId, studentName: names.get(entry.studentId) || entry.studentId, before: JSON.parse(entry.before), after: JSON.parse(entry.after) })) });
}));

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
        ...testSettingsFromBody(req.body),
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
    const data = { ...testSettingsFromBody(req.body) };
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

// Testni boshlash. Vaqt hisobi shu yerdan ketadi: boshlanish vaqti bazaga
// yoziladi, front esa faqat tugash vaqtini oladi — sahifani yangilash yoki
// tabni yopib qaytish vaqtni uzaytirmaydi.
router.post(
  "/:id/start-test",
  requireRole("STUDENT"),
  route(async (req, res) => {
    const started = await userTransaction(req.user.id, async (prisma) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type !== "TEST") throw new HttpError(400, "Bu vazifa TEST turida emas");
    if (new Date(assignment.dueDate) < new Date()) throw new HttpError(403, "Vazifa muddati yopilgan");

    const where = { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } };
    let submission = await prisma.submission.findUnique({ where });

    // Oldingi urinish boshlangan, lekin yakunlanmagan va vaqti tugagan bo'lsa —
    // u yo'qolgan urinish sifatida yopiladi (aks holda vaqt tugagach sahifani
    // yangilab, yangi oynani cheksiz ochish mumkin bo'lardi).
    const startedNotSubmitted = !!submission?.testStartedAt;
    if (startedNotSubmitted && !isWindowOpen(submission.testStartedAt, assignment.timeLimitSec)) {
      submission = await prisma.submission.update({
        where,
        data: {
          attempts: (submission.attempts || 0) + 1,
          testStartedAt: null,
          // Hech narsa yuborilmagan bo'lsa — 0 ball qayd etiladi.
          ...(submission.score == null ? { score: 0, status: "REVIEWED", submittedAt: new Date() } : {}),
        },
      });
    }

    const used = submission?.attempts || 0;
    const windowOpen = submission?.testStartedAt && isWindowOpen(submission.testStartedAt, assignment.timeLimitSec);

    // Ochiq oyna bo'lmasa — yangi urinish; urinishlar tugagan bo'lsa ruxsat yo'q.
    if (!windowOpen) {
      if (assignment.maxAttempts && used >= assignment.maxAttempts) {
        return { exhausted: true };
      }
      submission = await prisma.submission.upsert({
        where,
        update: { testStartedAt: new Date() },
        create: { assignmentId: req.params.id, studentId: req.user.id, testStartedAt: new Date() },
      });
    }

    return {
      questions: shapeAssignment({ ...assignment, materials: [], steps: [], submissions: [submission] }, req.user).questions,
      startedAt: submission.testStartedAt,
      endsAt: endsAt(submission.testStartedAt, assignment.timeLimitSec),
      timeLimitSec: assignment.timeLimitSec,
      attempts: submission.attempts || 0,
      maxAttempts: assignment.maxAttempts,
    };
    });
    if (started.exhausted) return res.status(403).json({ error: "Urinishlar tugadi" });
    res.json(started);
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
      const { chosenIds, isCorrect } = gradeQuestion(q, answers?.[q.id]);
      if (isCorrect) correctCount++;
      // correctOptionIds исключен во избежание утечки правильных ответов
      return { questionId: q.id, chosenOptionIds: chosenIds, isCorrect };
    });
    const total = assignment.questions.length;
    const score = total ? Math.round((correctCount / total) * assignment.maxScore) : 0;

    const outcome = await userTransaction(req.user.id, async (tx) => {
      const existing = await tx.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
      });
      requireStartedAttempt(existing);
      const usedAttempts = existing.attempts || 0;
      if (assignment.maxAttempts && usedAttempts >= assignment.maxAttempts) {
        throw new HttpError(
          403,
          `Urinishlar tugadi (${assignment.maxAttempts} tadan ${usedAttempts} ta ishlatilgan)`
        );
      }

      // Vaqti tugagan javob qabul qilinmaydi — urinish esa sarflangan hisoblanadi.
      if (assignment.timeLimitSec && isExpired(existing?.testStartedAt, assignment.timeLimitSec)) {
        await tx.submission.update({
          where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
          data: {
            attempts: usedAttempts + 1,
            testStartedAt: null,
            ...(existing.score == null ? { score: 0, status: "REVIEWED", submittedAt: new Date() } : {}),
          },
        });
        return { expired: true };
      }

      const previous = existing;
      const newAttempts = usedAttempts + 1;
      await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user.id } },
        update: { fileId: null, submittedAt: new Date(), score, creditedPoints: score, comment: null, status: "REVIEWED", attempts: newAttempts, testStartedAt: null },
        create: { assignmentId: req.params.id, studentId: req.user.id, score, creditedPoints: score, status: "REVIEWED", attempts: newAttempts },
      });

      // Qayta topshirilganda ball farqi qo'shiladi (birinchi marta esa to'liq ball).
      const pointsDelta = score - (previous?.creditedPoints || 0);
      if (pointsDelta !== 0) {
        await tx.user.update({ where: { id: req.user.id }, data: { points: { increment: pointsDelta } } });
      }

      await auditGrade(tx, req.user.id, req.user.id, assignment.id, "TEST_SUBMIT", previous, { score, attempts: newAttempts });
      return { attempts: newAttempts };
    });

    if (outcome.expired) return res.status(403).json({ error: "Test vaqti tugagan" });
    const { attempts } = outcome;
    res.json({
      correctCount,
      total,
      score,
      maxScore: assignment.maxScore,
      attempts,
      maxAttempts: assignment.maxAttempts,
      results,
    });
  })
);

// Talaba ishni topshiradi: bir nechta fayl (10MB chegarasi HAR BIR faylga
// alohida tegishli, shuning uchun katta ishni bo'lib yuborish mumkin) va
// ixtiyoriy izoh.
router.post(
  "/:id/submit",
  requireRole("STUDENT"),
  route(async (req, res, next) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type !== "FILE" || new Date(assignment.dueDate) < new Date()) throw new HttpError(403, "Bu vazifaga fayl yuborib bo'lmaydi");
    next();
  }),
  upload.array("files", 10),
  route(async (req, res) => {
    const uploaded = req.files || [];
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (uploaded.length === 0) throw new HttpError(400, "Kamida bitta fayl tanlang");

    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) throw new HttpError(404, "Vazifa topilmadi");
    if (assignment.type === "TEST") throw new HttpError(400, "Bu vazifa TEST turida — fayl emas, javoblar yuboriladi");
    if (new Date(assignment.dueDate) < new Date()) throw new HttpError(403, "Vazifa muddati yopilgan");

    await userTransaction(req.user.id, async (tx) => {
      const previous = await tx.submission.findUnique({ where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: req.user.id } } });
      const records = [];
      for (const f of uploaded) records.push(await createUploadedFileRecord(f, req.user.id, tx));
      const data = { fileId: records[0].id, text: text || null, submittedAt: new Date(), score: null,
        creditedPoints: 0, comment: null, status: "NOT_REVIEWED" };
      const submission = await tx.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: req.user.id } },
        update: data, create: { ...data, assignmentId: assignment.id, studentId: req.user.id },
      });
      if (previous?.creditedPoints) await tx.user.update({ where: { id: req.user.id }, data: { points: { decrement: previous.creditedPoints } } });
      await tx.submissionFile.deleteMany({ where: { submissionId: submission.id } });
      await tx.submissionFile.createMany({ data: records.map((file, order) => ({ submissionId: submission.id, fileId: file.id, order })) });
      await auditGrade(tx, req.user.id, req.user.id, submission.id, "RESUBMIT", previous, { score: null, creditedPoints: 0 });
    });

    await notifyStaff({
      type: TYPES.SUBMISSION_NEW,
      title: "Yangi javob keldi",
      body: `${req.user.firstName} ${req.user.lastName} — ${assignment.title} (${uploaded.length} ta fayl)`,
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

    const target = await prisma.submission.findUnique({ where: { id: req.params.subId } });
    if (!target || target.assignmentId !== assignment.id) throw new HttpError(404, "Javob topilmadi");
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || !Number.isInteger(numericScore)) throw new HttpError(400, "Ball butun raqam bo'lishi kerak");
    const clampedScore = Math.max(0, Math.min(numericScore, assignment.maxScore));
    const submission = await userTransaction(target.studentId, async (tx) => {
      const previous = await tx.submission.findUnique({ where: { id: target.id } });
      if (!previous || previous.assignmentId !== assignment.id) throw new HttpError(404, "Javob topilmadi");
      const updated = await tx.submission.update({ where: { id: previous.id }, data: {
        score: clampedScore, creditedPoints: clampedScore,
        comment: isEmptyHtml(comment) ? null : sanitizeHtml(comment), status: "REVIEWED",
      } });
      const delta = clampedScore - previous.creditedPoints;
      if (delta) await tx.user.update({ where: { id: target.studentId }, data: { points: { increment: delta } } });
      await auditGrade(tx, req.user.id, target.studentId, previous.id, "GRADE", { score: previous.score, creditedPoints: previous.creditedPoints }, { score: clampedScore, creditedPoints: clampedScore });
      return updated;
    });

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
