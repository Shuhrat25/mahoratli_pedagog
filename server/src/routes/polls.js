const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

const include = { options: { include: { votes: true }, orderBy: { order: "asc" } } };

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

function shapePoll(poll, user) {
  const votedOptionIds = poll.options.filter((o) => o.votes.some((v) => v.userId === user.id)).map((o) => o.id);
  const hasVoted = votedOptionIds.length > 0;
  // `correct` maydoni bazada bor edi, lekin hech qayerda ishlatilmasdi.
  // Endi u so'rovnomani kichik viktorinaga aylantiradi: to'g'ri javob ovoz
  // berilgandan keyin (yoki o'qituvchiga darhol) ko'rsatiladi.
  const revealCorrect = hasVoted || isStaff(user);
  const hasCorrect = poll.options.some((o) => o.correct);

  return {
    id: poll.id,
    question: poll.question,
    multiple: poll.multiple,
    createdAt: poll.createdAt,
    quiz: hasCorrect,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: o.votes.length,
      ...(revealCorrect && hasCorrect ? { correct: o.correct } : {}),
    })),
    votedOptionIds,
  };
}

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const polls = await prisma.poll.findMany({ include, orderBy: { createdAt: "desc" } });
    res.json({ polls: polls.map((p) => shapePoll(p, req.user)) });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    const { question, multiple = false, options } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2) {
      throw new HttpError(400, "Savol va kamida 2 ta variant talab qilinadi");
    }
    const poll = await prisma.poll.create({
      data: {
        question,
        multiple: !!multiple,
        options: { create: options.map((o, i) => ({ text: o.text, correct: !!o.correct, order: i })) },
      },
      include,
    });
    res.status(201).json({ poll: shapePoll(poll, req.user) });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.poll.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/vote",
  requireAuth,
  route(async (req, res) => {
    const { optionId } = req.body;
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
    if (!poll) throw new HttpError(404, "So'rovnoma topilmadi");
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new HttpError(400, "Variant topilmadi");

    const alreadyVotedThisOption = option.votes.some((v) => v.userId === req.user.id);
    if (alreadyVotedThisOption) throw new HttpError(409, "Allaqachon ovoz bergansiz");

    if (!poll.multiple) {
      const votedAny = poll.options.some((o) => o.votes.some((v) => v.userId === req.user.id));
      if (votedAny) throw new HttpError(409, "Allaqachon ovoz bergansiz");
    }

    await prisma.pollVote.create({ data: { pollOptionId: optionId, userId: req.user.id } });
    const updated = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
    res.json({ poll: shapePoll(updated, req.user) });
  })
);

// Ovozni qaytarib olish — ilgari umuman imkoni yo'q edi (xato bosilsa, tamom).
router.delete(
  "/:id/vote",
  requireAuth,
  route(async (req, res) => {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
    if (!poll) throw new HttpError(404, "So'rovnoma topilmadi");
    await prisma.pollVote.deleteMany({
      where: { userId: req.user.id, pollOptionId: { in: poll.options.map((o) => o.id) } },
    });
    const updated = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
    res.json({ poll: shapePoll(updated, req.user) });
  })
);

module.exports = router;
