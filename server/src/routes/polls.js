const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const include = { options: { include: { votes: true }, orderBy: { order: "asc" } } };

function shapePoll(poll, userId) {
  const votedOptionIds = poll.options.filter((o) => o.votes.some((v) => v.userId === userId)).map((o) => o.id);
  return {
    id: poll.id,
    question: poll.question,
    multiple: poll.multiple,
    options: poll.options.map((o) => ({ id: o.id, text: o.text, votes: o.votes.length })),
    votedOptionIds,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const polls = await prisma.poll.findMany({ include, orderBy: { createdAt: "desc" } });
  res.json({ polls: polls.map((p) => shapePoll(p, req.user.id)) });
});

router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  const { question, multiple = false, options } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: "Savol va kamida 2 ta variant talab qilinadi" });
  }
  const poll = await prisma.poll.create({
    data: {
      question,
      multiple,
      options: { create: options.map((o, i) => ({ text: o.text, correct: !!o.correct, order: i })) },
    },
    include,
  });
  res.status(201).json({ poll: shapePoll(poll, req.user.id) });
});

router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.poll.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/vote", requireAuth, async (req, res) => {
  const { optionId } = req.body;
  const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
  if (!poll) return res.status(404).json({ error: "So'rovnoma topilmadi" });
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return res.status(400).json({ error: "Variant topilmadi" });

  const alreadyVotedThisOption = option.votes.some((v) => v.userId === req.user.id);
  if (alreadyVotedThisOption) return res.status(409).json({ error: "Allaqachon ovoz bergansiz" });

  if (!poll.multiple) {
    const votedAny = poll.options.some((o) => o.votes.some((v) => v.userId === req.user.id));
    if (votedAny) return res.status(409).json({ error: "Allaqachon ovoz bergansiz" });
  }

  await prisma.pollVote.create({ data: { pollOptionId: optionId, userId: req.user.id } });
  const updated = await prisma.poll.findUnique({ where: { id: req.params.id }, include });
  res.json({ poll: shapePoll(updated, req.user.id) });
});

module.exports = router;
