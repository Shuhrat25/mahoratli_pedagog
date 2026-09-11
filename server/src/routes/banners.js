const express = require("express");
const prisma = require("../db");
const { requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { sanitizeHtml } = require("../lib/sanitizeHtml");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

// Tailwind JIT bu klasslarni faqat manba kodida so'zma-so'z uchratsa generatsiya
// qiladi — shu qatordagi klasslar tailwind.config.js'dagi safelist bilan mos
// kelishi shart, aks holda banner foni chizilmay, matn ko'rinmay qoladi.
const GRADIENTS = [
  "from-brand-600 to-sky-700",
  "from-sky-600 to-cyan-700",
  "from-cyan-600 to-blue-700",
  "from-blue-600 to-indigo-700",
  "from-indigo-600 to-violet-700",
];

router.get("/", route(async (req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: { order: "asc" } });
  res.json({ banners });
}));

// upload.single("image") faqat multipart/form-data so'rovlarda ishlaydi —
// oddiy JSON so'rov kelsa (rasmsiz tahrirlash), shunchaki o'tkazib yuboradi.
router.post("/", requireRole("ADMIN", "TEACHER"), upload.single("image"), route(async (req, res) => {
  const { title, text, color } = req.body;
  if (!title || !text) throw new HttpError(400, "Sarlavha va matn talab qilinadi");

  let imageId;
  if (req.file) {
    const file = await createUploadedFileRecord(req.file, req.user.id);
    imageId = file.id;
  }

  const count = await prisma.banner.count();
  const banner = await prisma.banner.create({
    data: {
      title,
      text: sanitizeHtml(text),
      color: color || GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      order: count,
      imageId,
    },
  });
  res.status(201).json({ banner });
}));

router.patch("/:id", requireRole("ADMIN", "TEACHER"), upload.single("image"), route(async (req, res) => {
  const { title, text, color } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (text !== undefined) data.text = sanitizeHtml(text);
  if (color !== undefined) data.color = color;
  if (req.file) {
    const file = await createUploadedFileRecord(req.file, req.user.id);
    data.imageId = file.id;
  }
  const banner = await prisma.banner.update({ where: { id: req.params.id }, data });
  res.json({ banner });
}));

router.delete("/:id", requireRole("ADMIN", "TEACHER"), route(async (req, res) => {
  await prisma.banner.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

router.patch("/:id/move", requireRole("ADMIN", "TEACHER"), route(async (req, res) => {
  const { direction } = req.body; // -1 yoki 1
  const banners = await prisma.banner.findMany({ orderBy: { order: "asc" } });
  const idx = banners.findIndex((b) => b.id === req.params.id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= banners.length) {
    throw new HttpError(400, "Ko'chirib bo'lmaydi");
  }
  await prisma.$transaction([
    prisma.banner.update({ where: { id: banners[idx].id }, data: { order: banners[swapIdx].order } }),
    prisma.banner.update({ where: { id: banners[swapIdx].id }, data: { order: banners[idx].order } }),
  ]);
  const updated = await prisma.banner.findMany({ orderBy: { order: "asc" } });
  res.json({ banners: updated });
}));

module.exports = router;
