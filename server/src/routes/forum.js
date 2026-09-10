const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sanitizeHtml } = require("../lib/sanitizeHtml");

const router = express.Router();

const include = {
  author: true,
  replies: { include: { author: true }, orderBy: { createdAt: "asc" } },
};

function canModerate(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

function shapeThread(t) {
  return {
    id: t.id,
    title: t.title,
    authorId: t.authorId,
    authorName: `${t.author.firstName} ${t.author.lastName}`,
    createdAt: t.createdAt,
    replies: t.replies.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorName: `${r.author.firstName} ${r.author.lastName}`,
      text: r.text,
      createdAt: r.createdAt,
    })),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const threads = await prisma.forumThread.findMany({ include, orderBy: { createdAt: "desc" } });
  res.json({ threads: threads.map(shapeThread) });
});

router.get("/:id", requireAuth, async (req, res) => {
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
  if (!thread) return res.status(404).json({ error: "Mavzu topilmadi" });
  res.json({ thread: shapeThread(thread) });
});

router.post("/", requireAuth, async (req, res) => {
  const { title, text } = req.body;
  if (!title) return res.status(400).json({ error: "Sarlavha talab qilinadi" });
  const thread = await prisma.forumThread.create({
    data: {
      title,
      authorId: req.user.id,
      replies: text ? { create: [{ text: sanitizeHtml(text), authorId: req.user.id }] } : undefined,
    },
    include,
  });
  res.status(201).json({ thread: shapeThread(thread) });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
  if (!thread) return res.status(404).json({ error: "Mavzu topilmadi" });
  if (thread.authorId !== req.user.id && !canModerate(req.user)) {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }
  await prisma.forumThread.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/replies", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Matn talab qilinadi" });
  await prisma.forumReply.create({
    data: { text: sanitizeHtml(text), threadId: req.params.id, authorId: req.user.id },
  });
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
  res.status(201).json({ thread: shapeThread(thread) });
});

router.delete("/:id/replies/:replyId", requireAuth, async (req, res) => {
  const reply = await prisma.forumReply.findUnique({ where: { id: req.params.replyId } });
  if (!reply) return res.status(404).json({ error: "Javob topilmadi" });
  if (reply.authorId !== req.user.id && !canModerate(req.user)) {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }
  await prisma.forumReply.delete({ where: { id: req.params.replyId } });
  const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
  res.json({ thread: shapeThread(thread) });
});

module.exports = router;
