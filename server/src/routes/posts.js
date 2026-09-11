const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { sanitizeHtml } = require("../lib/sanitizeHtml");
const { HttpError, route } = require("../lib/httpError");
const { POST_STATUSES } = require("../lib/constants");
const { notifyAllStudents, TYPES } = require("../lib/notifications");

const router = express.Router();

const include = {
  author: true,
  likes: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
};

function parseTags(raw) {
  if (raw === undefined || raw === null) return undefined;
  const list = String(raw)
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  const unique = [...new Set(list)].slice(0, 10);
  return unique.length ? unique.join(",") : null;
}

function tagList(raw) {
  return raw ? raw.split(",").filter(Boolean) : [];
}

/** O'qish vaqti — matndagi so'zlar soni / 200 (o'rtacha o'qish tezligi). */
function readingMinutes(html) {
  const text = String(html || "").replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function shapePost(post, userId) {
  return {
    id: post.id,
    authorId: post.authorId,
    authorName: `${post.author.firstName} ${post.author.lastName}`,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    status: post.status,
    pinned: post.pinned,
    tags: tagList(post.tags),
    readingMinutes: readingMinutes(post.text),
    title: post.title,
    text: post.text,
    videoUrl: post.videoUrl,
    imageId: post.imageId,
    likes: post.likes.length,
    liked: userId ? post.likes.some((l) => l.userId === userId) : false,
    comments: post.comments.map((c) => ({
      id: c.id,
      author: `${c.author.firstName} ${c.author.lastName}`,
      authorId: c.authorId,
      text: c.text,
      createdAt: c.createdAt,
    })),
  };
}

function isStaff(user) {
  return user?.role === "TEACHER" || user?.role === "ADMIN";
}

/** Talabaga faqat e'lon qilingan va vaqti kelgan postlar ko'rinadi. */
function publishedFilter() {
  return { status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] };
}

function searchFilter(search) {
  if (!search) return null;
  // Postgres'da `contains` registrga sezgir — insensitive rejim shart.
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { text: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } },
    ],
  };
}

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const staff = isStaff(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const { search = "", tag = "", status = "" } = req.query;

    const and = [];
    if (!staff) and.push(publishedFilter());
    else if (status && POST_STATUSES.includes(status)) and.push({ status });
    const searchWhere = searchFilter(search.trim());
    if (searchWhere) and.push(searchWhere);
    if (tag) and.push({ tags: { contains: tag, mode: "insensitive" } });

    const where = and.length ? { AND: and } : {};

    const [total, posts, allTagRows] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        include,
        // Qadalgan postlar doim tepada, keyin e'lon vaqti bo'yicha.
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.findMany({
        where: staff ? {} : publishedFilter(),
        select: { tags: true },
      }),
    ]);

    const tags = [...new Set(allTagRows.flatMap((p) => tagList(p.tags)))].sort((a, b) =>
      a.localeCompare(b, "uz")
    );

    res.json({
      posts: posts.map((p) => shapePost(p, req.user.id)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      tags,
    });
  })
);

// Ochiq (avtorizatsiyasiz) bitta post — ulashish havolasi va Open Graph
// meta-teglari uchun. Faqat e'lon qilingan postlar chiqadi.
router.get(
  "/public/:id",
  route(async (req, res) => {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, ...publishedFilter() },
      include,
    });
    if (!post) throw new HttpError(404, "Post topilmadi");
    const shaped = shapePost(post, null);
    // Mehmonlarga izohlar ko'rsatilmaydi.
    res.json({ post: { ...shaped, comments: [], commentCount: post.comments.length } });
  })
);

router.get(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const where = isStaff(req.user) ? { id: req.params.id } : { id: req.params.id, ...publishedFilter() };
    const post = await prisma.post.findFirst({ where, include });
    if (!post) throw new HttpError(404, "Post topilmadi");
    res.json({ post: shapePost(post, req.user.id) });
  })
);

function statusFromBody(body) {
  const status = POST_STATUSES.includes(body.status) ? body.status : "PUBLISHED";
  // publishedAt kelajakdagi sana bo'lsa — rejalashtirilgan e'lon.
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : status === "PUBLISHED" ? new Date() : null;
  return { status, publishedAt };
}

/** Post shu daqiqada talabalarga ko'rinadimi? */
function isLive(post) {
  return post.status === "PUBLISHED" && (!post.publishedAt || post.publishedAt <= new Date());
}

// upload.single("image") faqat multipart/form-data so'rovlarda ishlaydi —
// rasm biriktirilmasa oddiy JSON sifatida ham qabul qilinadi.
router.post(
  "/",
  requireRole("ADMIN", "TEACHER"),
  upload.single("image"),
  route(async (req, res) => {
    const { title, text, videoUrl, pinned } = req.body;
    if (!title) throw new HttpError(400, "Sarlavha talab qilinadi");

    let imageId;
    if (req.file) {
      const file = await createUploadedFileRecord(req.file, req.user.id);
      imageId = file.id;
    }

    const post = await prisma.post.create({
      data: {
        title,
        text: text ? sanitizeHtml(text) : null,
        videoUrl: videoUrl || null,
        imageId,
        authorId: req.user.id,
        pinned: pinned === true || pinned === "true",
        tags: parseTags(req.body.tags) ?? null,
        ...statusFromBody(req.body),
      },
      include,
    });

    if (isLive(post)) {
      await notifyAllStudents({
        type: TYPES.POST_NEW,
        title: "Yangi e'lon",
        body: post.title,
        link: `/post/${post.id}`,
      });
    }

    res.status(201).json({ post: shapePost(post, req.user.id) });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  upload.single("image"),
  route(async (req, res) => {
    const { title, text, videoUrl, pinned, status } = req.body;
    const before = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!before) throw new HttpError(404, "Post topilmadi");

    const data = {};
    if (title !== undefined) data.title = title;
    if (text !== undefined) data.text = text ? sanitizeHtml(text) : null;
    if (videoUrl !== undefined) data.videoUrl = videoUrl || null;
    if (pinned !== undefined) data.pinned = pinned === true || pinned === "true";
    const tags = parseTags(req.body.tags);
    if (tags !== undefined) data.tags = tags;
    if (status !== undefined || req.body.publishedAt !== undefined) {
      Object.assign(data, statusFromBody({ ...req.body, status: status ?? before.status }));
    }
    if (req.file) {
      const file = await createUploadedFileRecord(req.file, req.user.id);
      data.imageId = file.id;
    }

    const post = await prisma.post.update({ where: { id: req.params.id }, data, include });

    // Qoralamadan e'longa o'tganda talabalarga xabar beriladi (takror emas).
    if (!isLive(before) && isLive(post)) {
      await notifyAllStudents({
        type: TYPES.POST_NEW,
        title: "Yangi e'lon",
        body: post.title,
        link: `/post/${post.id}`,
      });
    }

    res.json({ post: shapePost(post, req.user.id) });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "TEACHER"),
  route(async (req, res) => {
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/like",
  requireAuth,
  route(async (req, res) => {
    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.user.id } },
    });
    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.postLike.create({ data: { postId: req.params.id, userId: req.user.id } });
    }
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include });
    if (!post) throw new HttpError(404, "Post topilmadi");
    res.json({ post: shapePost(post, req.user.id) });
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  route(async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) throw new HttpError(400, "Matn talab qilinadi");
    await prisma.comment.create({
      data: { text: sanitizeHtml(text), postId: req.params.id, authorId: req.user.id },
    });
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include });
    if (!post) throw new HttpError(404, "Post topilmadi");
    res.status(201).json({ post: shapePost(post, req.user.id) });
  })
);

router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  route(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) throw new HttpError(404, "Izoh topilmadi");
    if (comment.authorId !== req.user.id && !isStaff(req.user)) throw new HttpError(403, "Ruxsat yo'q");
    await prisma.comment.delete({ where: { id: req.params.commentId } });
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include });
    res.json({ post: shapePost(post, req.user.id) });
  })
);

module.exports = router;
