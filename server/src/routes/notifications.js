const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { route } = require("../lib/httpError");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  route(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ]);
    res.json({ notifications: items, unread });
  })
);

router.post(
  "/read",
  requireAuth,
  route(async (req, res) => {
    const { ids } = req.body;
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        ...(Array.isArray(ids) && ids.length ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });
    const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ ok: true, unread });
  })
);

router.delete(
  "/",
  requireAuth,
  route(async (req, res) => {
    await prisma.notification.deleteMany({ where: { userId: req.user.id } });
    res.json({ ok: true, unread: 0 });
  })
);

module.exports = router;
