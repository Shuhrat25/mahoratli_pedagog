const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");

const router = express.Router();

function shapePost(post, userId) {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: `${post.author.firstName} ${post.author.lastName}`,
    createdAt: post.createdAt,
    title: post.title,
    text: post.text,
    videoUrl: post.videoUrl,
    imageId: post.imageId,
    likes: post.likes.length,
    liked: userId ? post.likes.some((l) => l.userId === userId) : false,
    comments: post.comments.map((c) => ({
      id: c.id,
      author: `${c.author.firstName} ${c.author.lastName}`,
      text: c.text,
      createdAt: c.createdAt,
    })),
  };
}

const include = {
  author: true,
  likes: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
};

router.get("/", requireAuth, async (req, res) => {
  const posts = await prisma.post.findMany({ include, orderBy: { createdAt: "desc" } });
  res.json({ posts: posts.map((p) => shapePost(p, req.user.id)) });
});

// upload.single("image") faqat multipart/form-data so'rovlarda ishlaydi —
// rasm biriktirilmasa oddiy JSON sifatida ham qabul qilinadi.
router.post("/", requireRole("ADMIN", "TEACHER"), upload.single("image"), async (req, res) => {
  const { title, text, videoUrl } = req.body;
  if (!title) return res.status(400).json({ error: "Sarlavha talab qilinadi" });

  let imageId;
  if (req.file) {
    const file = await createUploadedFileRecord(req.file, req.user.id);
    imageId = file.id;
  }

  const post = await prisma.post.create({
    data: { title, text: text || null, videoUrl: videoUrl || null, imageId, authorId: req.user.id },
    include,
  });
  res.status(201).json({ post: shapePost(post, req.user.id) });
});

router.patch("/:id", requireRole("ADMIN", "TEACHER"), upload.single("image"), async (req, res) => {
  const { title, text, videoUrl } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (text !== undefined) data.text = text || null;
  if (videoUrl !== undefined) data.videoUrl = videoUrl || null;
  if (req.file) {
    const file = await createUploadedFileRecord(req.file, req.user.id);
    data.imageId = file.id;
  }
  const post = await prisma.post.update({ where: { id: req.params.id }, data, include });
  res.json({ post: shapePost(post, req.user.id) });
});

router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/like", requireAuth, async (req, res) => {
  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: req.params.id, userId: req.user.id } },
  });
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.postLike.create({ data: { postId: req.params.id, userId: req.user.id } });
  }
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include });
  res.json({ post: shapePost(post, req.user.id) });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Matn talab qilinadi" });
  await prisma.comment.create({ data: { text, postId: req.params.id, authorId: req.user.id } });
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include });
  res.status(201).json({ post: shapePost(post, req.user.id) });
});

module.exports = router;
