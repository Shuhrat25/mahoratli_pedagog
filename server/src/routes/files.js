const express = require("express");
const path = require("path");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { HttpError, route } = require("../lib/httpError");

const { publishedReference, sharedInlineReference } = require('../lib/fileAccess');
const { findLockedLesson } = require('../lib/lessonLookup');
const router = express.Router();
router.use((req, res, next) => {
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('Cache-Control', 'private, no-store');
 next();
});

const SAFE_RASTER_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const SAFE_MEDIA_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
]);

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

// Rich-text tahrirlagichga qo'yiladigan rasm.
//
// Boshqa yuklash yo'llaridan farqi: bu fayl hech qanday vazifa/materialga
// biriktirilmaydi — u bevosita matn ichiga <img> bo'lib tushadi. Hajm chegarasi
// odatdagidek roldan kelib chiqadi (talaba — 10MB, o'qituvchi — cheklovsiz).
router.post(
  "/inline",
  requireAuth,
  upload.single("image"),
  route(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Rasm talab qilinadi");
    if (!SAFE_RASTER_MIMES.has(req.file.mimetype)) {
      throw new HttpError(400, "Faqat rasm yuklash mumkin");
    }
    const file = await createUploadedFileRecord(req.file, req.user.id);
    res.status(201).json({ file: { id: file.id, name: file.originalName, url: `/api/files/${file.id}` } });
  })
);

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

    if (!SAFE_RASTER_MIMES.has(file.mimeType)) throw new HttpError(403, "Ruxsat yo'q");

    const now = new Date();
    const onLivePost = file.posts.some(
      (p) => p.status === "PUBLISHED" && (!p.publishedAt || p.publishedAt <= now)
    );

    // Rasm postning MUQOVASI bo'lmasligi ham mumkin — u matn ichiga qo'yilgan
    // bo'lsa (<img src=".../files/<id>">) hech qanday jadvalga biriktirilmaydi.
    // Shuning uchun e'lon qilingan post matnida shu id uchraydimi, deb qaraymiz.
    const insideLivePost = onLivePost || await publishedReference(prisma, file);

    if (!insideLivePost && file.banners.length === 0) throw new HttpError(403, "Ruxsat yo'q");

    res.type(file.mimeType);
    res.setHeader("Cache-Control", "no-store");
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
        submissionFiles: { include: { submission: { select: { studentId: true } } } },
        materials: true,
        assignmentMaterials: true,
        lessonMaterials: true,
        puzzleImages: true,
        uploadedBy: { select: { role: true } },
        banners: true,
        posts: true,
      },
    });
    if (!file) throw new HttpError(404, "Fayl topilmadi");

    const now = new Date();
    const hasPublishedPost = file.posts.some(
      (p) => p.status === "PUBLISHED" && (!p.publishedAt || p.publishedAt <= now)
    );

    const isPublicMaterial =
      file.materials.length > 0 ||
      file.assignmentMaterials.length > 0 ||
      file.banners.length > 0 ||
      hasPublishedPost;
    const isOwnSubmission =
      file.submissions.some((s) => s.studentId === req.user.id) ||
      file.submissionFiles.some((sf) => sf.submission.studentId === req.user.id);

    // Matn ichiga qo'yilgan xavfsiz rasm ("inline")
    let allowed = isPublicMaterial || isOwnSubmission || isStaff(req.user) || file.uploadedById === req.user.id;
    if (!allowed) {
      for (const reference of [...file.lessonMaterials, ...file.puzzleImages]) {
        const found = await findLockedLesson(req.user.id, reference.lessonId);
        if (found && !found.lesson.locked) { allowed = true; break; }
      }
    }
    if (!allowed && SAFE_RASTER_MIMES.has(file.mimeType)) allowed = await sharedInlineReference(prisma, file, req.user);
    if (!allowed) throw new HttpError(403, "Ruxsat yo'q");

    const filePath = path.join(UPLOAD_DIR, file.storedName);
    const isSafeRaster = SAFE_RASTER_MIMES.has(file.mimeType);
    const isSafeMedia = SAFE_MEDIA_MIMES.has(file.mimeType);
    const isPdf = file.mimeType === "application/pdf";

    // Xavfsiz rastr va media formatlar bevosita ko'rsatiladi
    if (isSafeRaster || isSafeMedia) {
      res.type(file.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
      return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
      });
    }

    if (isPdf) {
      res.type(file.mimeType);
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
      return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
      });
    }

    // Boshqa barcha fayllar (shu jumladan SVG) uchun majburiy yuklab olish va qat'iy CSP
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.download(filePath, file.originalName, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Fayl topilmadi" });
    });
  })
);

module.exports = router;
