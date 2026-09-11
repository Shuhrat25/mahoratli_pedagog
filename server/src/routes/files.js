const express = require("express");
const path = require("path");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { UPLOAD_DIR } = require("../middleware/upload");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

// Ochiq rasm — e'lon qilingan post yoki bannerga biriktirilgan fayllar uchun.
// Ulashish havolasining Open Graph rasmini ijtimoiy tarmoqlarning botlari
// oladi, ular esa avtorizatsiyadan o'tolmaydi.
router.get(
  "/public/:id",
  route(async (req, res) => {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: req.params.id },
      include: {
        banners: { select: { id: true } },
        posts: { select: { status: true, publishedAt: true } },
      },
    });
    if (!file) throw new HttpError(404, "Fayl topilmadi");

    const now = new Date();
    const onLivePost = file.posts.some(
      (p) => p.status === "PUBLISHED" && (!p.publishedAt || p.publishedAt <= now)
    );
    if (!onLivePost && file.banners.length === 0) throw new HttpError(403, "Ruxsat yo'q");
    if (!/^image\//.test(file.mimeType || "")) throw new HttpError(403, "Ruxsat yo'q");

    res.type(file.mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(path.join(UPLOAD_DIR, file.storedName), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
    });
  })
);

router.get(
  "/:id",
  requireAuth,
  route(async (req, res) => {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: req.params.id },
      include: {
        submissions: true,
        materials: true,
        assignmentMaterials: true,
        lessonMaterials: true,
        banners: true,
        posts: true,
      },
    });
    if (!file) throw new HttpError(404, "Fayl topilmadi");

    const isPublicMaterial =
      file.materials.length > 0 ||
      file.assignmentMaterials.length > 0 ||
      file.lessonMaterials.length > 0 ||
      file.banners.length > 0 ||
      file.posts.length > 0;
    const isOwnSubmission = file.submissions.some((s) => s.studentId === req.user.id);
    const allowed = isPublicMaterial || isOwnSubmission || isStaff(req.user) || file.uploadedById === req.user.id;
    if (!allowed) throw new HttpError(403, "Ruxsat yo'q");

    // Rasm va videolar sahifada bevosita ko'rsatiladi (post rasmi, banner foni),
    // qolgan fayllar esa yuklab olinadi.
    const inline = /^(image|video|audio)\//.test(file.mimeType || "") || file.mimeType === "application/pdf";
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (inline) {
      res.type(file.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
      return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
      });
    }
    res.download(filePath, file.originalName, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
    });
  })
);

module.exports = router;
