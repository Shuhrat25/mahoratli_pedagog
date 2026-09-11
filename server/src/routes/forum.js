const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sanitizeHtml, isEmptyHtml } = require("../lib/sanitizeHtml");
const { HttpError, route } = require("../lib/httpError");
const { notify, notifyStaff, TYPES } = require("../lib/notifications");

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
    // Mavzu matni endi o'z ustunida — ilgari u birinchi "javob" sifatida
    // saqlanardi va o'sha javob o'chirilsa mavzu matnsiz qolardi.
    body: t.body,
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

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { body: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, threads] = await Promise.all([
      prisma.forumThread.count({ where }),
      prisma.forumThread.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      threads: threads.map(shapeThread),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

router.get(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
    if (!thread) throw new HttpError(404, "Mavzu topilmadi");
    res.json({ thread: shapeThread(thread) });
  })
);

router.post(
  "/",
  requireAuth,
  route(async (req, res) => {
    const { title, text } = req.body;
    if (!title || !title.trim()) throw new HttpError(400, "Sarlavha talab qilinadi");
    const thread = await prisma.forumThread.create({
      data: {
        title: title.trim(),
        body: isEmptyHtml(text) ? null : sanitizeHtml(text),
        authorId: req.user.id,
      },
      include,
    });

    // O'qituvchi/adminlar yangi mavzudan xabardor bo'lsin (o'zi yaratgan bo'lsa — yo'q).
    await notifyStaff(
      {
        type: TYPES.FORUM_REPLY,
        title: "Forumda yangi mavzu",
        body: thread.title,
        link: `/teacher/forum/${thread.id}`,
      },
      { exceptUserId: req.user.id }
    );

    res.status(201).json({ thread: shapeThread(thread) });
  })
);

router.patch(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
    if (!thread) throw new HttpError(404, "Mavzu topilmadi");
    if (thread.authorId !== req.user.id && !canModerate(req.user)) throw new HttpError(403, "Ruxsat yo'q");

    const { title, text } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (text !== undefined) data.body = isEmptyHtml(text) ? null : sanitizeHtml(text);

    const updated = await prisma.forumThread.update({ where: { id: thread.id }, data, include });
    res.json({ thread: shapeThread(updated) });
  })
);

router.delete(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
    if (!thread) throw new HttpError(404, "Mavzu topilmadi");
    if (thread.authorId !== req.user.id && !canModerate(req.user)) throw new HttpError(403, "Ruxsat yo'q");
    await prisma.forumThread.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/replies",
  requireAuth,
  route(async (req, res) => {
    const { text } = req.body;
    if (isEmptyHtml(text)) throw new HttpError(400, "Matn talab qilinadi");

    const thread = await prisma.forumThread.findUnique({
      where: { id: req.params.id },
      include: { replies: { select: { authorId: true } } },
    });
    if (!thread) throw new HttpError(404, "Mavzu topilmadi");

    await prisma.forumReply.create({
      data: { text: sanitizeHtml(text), threadId: req.params.id, authorId: req.user.id },
    });

    // Mavzu muallifiga va suhbatdagi boshqa ishtirokchilarga xabar.
    const participants = new Set([thread.authorId, ...thread.replies.map((r) => r.authorId)]);
    participants.delete(req.user.id);
    for (const userId of participants) {
      await notify(userId, {
        type: TYPES.FORUM_REPLY,
        title: "Forumdagi mavzuingizga javob",
        body: thread.title,
        // Havola foydalanuvchi kabinetiga nisbatan (front `/student/` yoki
        // `/teacher/` prefiksini qo'shadi) — suhbatda ikkala rol ham qatnashadi.
        link: `forum/${thread.id}`,
      });
    }

    const updated = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
    res.status(201).json({ thread: shapeThread(updated) });
  })
);

router.delete(
  "/:id/replies/:replyId",
  requireAuth,
  route(async (req, res) => {
    const reply = await prisma.forumReply.findUnique({ where: { id: req.params.replyId } });
    if (!reply) throw new HttpError(404, "Javob topilmadi");
    if (reply.authorId !== req.user.id && !canModerate(req.user)) throw new HttpError(403, "Ruxsat yo'q");
    await prisma.forumReply.delete({ where: { id: req.params.replyId } });
    const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id }, include });
    res.json({ thread: shapeThread(thread) });
  })
);

module.exports = router;
