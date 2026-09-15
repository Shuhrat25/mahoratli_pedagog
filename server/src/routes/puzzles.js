const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { HttpError, route } = require("../lib/httpError");
const { findLockedLesson } = require("../lib/lessonLookup");
const { PUZZLE_DIFFICULTIES } = require("../lib/constants");
const { minSolveSeconds } = require("../lib/puzzleRules");

const router = express.Router();

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

function parseDifficulty(value) {
  if (!Object.prototype.hasOwnProperty.call(PUZZLE_DIFFICULTIES, value)) {
    throw new HttpError(400, "Murakkablik darajasi noto'g'ri");
  }
  return value;
}

/** Rasm + uning darsi; talaba uchun dars ochiq bo'lishi shart. */
async function loadImageForUser(user, imageId) {
  const image = await prisma.puzzleImage.findUnique({
    where: { id: imageId },
    include: { lesson: { select: { id: true, type: true, puzzlePoints: true } } },
  });
  if (!image) throw new HttpError(404, "Rasm topilmadi");

  if (!isStaff(user)) {
    const found = await findLockedLesson(user.id, image.lessonId);
    if (!found) throw new HttpError(404, "Dars topilmadi");
    if (found.lesson.locked) throw new HttpError(403, "Bu dars hali qulflangan");
  }
  return image;
}

function shapeProgress(rows) {
  const byDifficulty = {};
  rows.forEach((row) => {
    byDifficulty[row.difficulty] = { bestTimeSec: row.bestTimeSec, solvedCount: row.solvedCount };
  });
  return byDifficulty;
}

// Talabaning shu darsdagi natijalari: har bir rasm uchun daraja bo'yicha eng
// yaxshi vaqt va necha marta yig'ilgani.
router.get(
  "/lesson/:lessonId",
  requireAuth,
  route(async (req, res) => {
    const found = await findLockedLesson(req.user.id, req.params.lessonId);
    if (!found || found.lesson.type !== "PUZZLE") throw new HttpError(404, "Dars topilmadi");
    if (!isStaff(req.user) && found.lesson.locked) throw new HttpError(403, "Bu dars hali qulflangan");

    const imageIds = found.lesson.puzzleImages.map((p) => p.id);
    const rows = await prisma.puzzleProgress.findMany({
      where: { userId: req.user.id, puzzleImageId: { in: imageIds } },
    });

    res.json({
      difficulties: PUZZLE_DIFFICULTIES,
      puzzlePoints: found.lesson.puzzlePoints,
      images: found.lesson.puzzleImages.map((p) => ({
        id: p.id,
        fileId: p.file.id,
        name: p.file.originalName,
        progress: shapeProgress(rows.filter((r) => r.puzzleImageId === p.id)),
      })),
    });
  })
);

// Yig'ishni boshlash — vaqt serverda hisoblanadi.
router.post(
  "/:imageId/start",
  requireAuth,
  route(async (req, res) => {
    const difficulty = parseDifficulty(req.body?.difficulty);
    const image = await loadImageForUser(req.user, req.params.imageId);
    const startedAt = new Date();
    await prisma.puzzleProgress.upsert({
      where: {
        userId_puzzleImageId_difficulty: { userId: req.user.id, puzzleImageId: image.id, difficulty },
      },
      update: { startedAt },
      create: { userId: req.user.id, puzzleImageId: image.id, difficulty, startedAt },
    });
    res.json({ startedAt });
  })
);

router.post(
  "/:imageId/solve",
  requireAuth,
  route(async (req, res) => {
    const difficulty = parseDifficulty(req.body?.difficulty);
    const image = await loadImageForUser(req.user, req.params.imageId);
    const key = { userId: req.user.id, puzzleImageId: image.id, difficulty };

    const progress = await prisma.puzzleProgress.findUnique({ where: { userId_puzzleImageId_difficulty: key } });
    if (!progress?.startedAt) throw new HttpError(400, "Avval pazlni boshlang");

    const now = new Date();
    const timeSec = Math.max(1, Math.round((now.getTime() - progress.startedAt.getTime()) / 1000));
    if (timeSec < minSolveSeconds(difficulty)) {
      throw new HttpError(400, "Pazl juda tez yig'ildi — natija qabul qilinmadi");
    }

    // Rasm avval (istalgan darajada) yig'ilganmi — ball faqat birinchi marta.
    const solvedBefore = await prisma.puzzleProgress.count({
      where: { userId: req.user.id, puzzleImageId: image.id, solvedCount: { gt: 0 } },
    });

    // startedAt bo'yicha shartli yangilash: bitta boshlanish ikki marta
    // hisoblanmaydi (tugma ikki marta bosilsa yoki so'rov takrorlansa).
    const isNewBest = progress.bestTimeSec == null || timeSec < progress.bestTimeSec;
    const claimed = await prisma.puzzleProgress.updateMany({
      where: { id: progress.id, startedAt: progress.startedAt },
      data: {
        startedAt: null,
        solvedCount: { increment: 1 },
        lastSolvedAt: now,
        ...(isNewBest ? { bestTimeSec: timeSec } : {}),
      },
    });
    if (claimed.count === 0) throw new HttpError(409, "Bu natija allaqachon qabul qilingan");

    let pointsAwarded = 0;
    if (!isStaff(req.user)) {
      if (solvedBefore === 0 && image.lesson.puzzlePoints > 0) {
        pointsAwarded = image.lesson.puzzlePoints;
        await prisma.user.update({ where: { id: req.user.id }, data: { points: { increment: pointsAwarded } } });
      }
      // Pazl ixtiyoriy, lekin yig'ilgan bo'lsa dars ro'yxatida belgilanadi.
      await prisma.lessonProgress.upsert({
        where: { lessonId_userId: { lessonId: image.lessonId, userId: req.user.id } },
        update: { completed: true },
        create: { lessonId: image.lessonId, userId: req.user.id, completed: true, completedAt: now },
      });
      await prisma.lessonProgress.updateMany({
        where: { lessonId: image.lessonId, userId: req.user.id, completedAt: null },
        data: { completedAt: now },
      });
    }

    res.json({
      timeSec,
      bestTimeSec: isNewBest ? timeSec : progress.bestTimeSec,
      isNewBest,
      solvedCount: progress.solvedCount + 1,
      pointsAwarded,
    });
  })
);

module.exports = router;
