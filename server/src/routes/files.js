const express = require("express");
const path = require("path");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

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
    if (!/^image\//.test(req.file.mimetype || "")) {
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

    if (!/^image\//.test(file.mimeType || "")) throw new HttpError(403, "Ruxsat yo'q");

    const now = new Date();
    const onLivePost = file.posts.some(
      (p) => p.status === "PUBLISHED" && (!p.publishedAt || p.publishedAt <= now)
    );

    // Rasm postning MUQOVASI bo'lmasligi ham mumkin — u matn ichiga qo'yilgan
    // bo'lsa (<img src=".../files/<id>">) hech qanday jadvalga biriktirilmaydi.
    // Shuning uchun e'lon qilingan post matnida shu id uchraydimi, deb qaraymiz.
    const insideLivePost = onLivePost
      ? true
      : !!(await prisma.post.findFirst({
          where: {
            status: "PUBLISHED",
            OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
            text: { contains: file.id },
          },
          select: { id: true },
        }));

    if (!insideLivePost && file.banners.length === 0) throw new HttpError(403, "Ruxsat yo'q");

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
        submissionFiles: { include: { submission: { select: { studentId: true } } } },
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
    const isOwnSubmission =
      file.submissions.some((s) => s.studentId === req.user.id) ||
      file.submissionFiles.some((sf) => sf.submission.studentId === req.user.id);

    // Matn ichiga qo'yilgan rasm ("inline") hech qanday jadvalga biriktirilmaydi,
    // shuning uchun yuqoridagi tekshiruvlarga tushmaydi. U post/forum matnining
    // bir qismi — ya'ni matnni ko'ra oladigan hamma uni ham ko'rishi kerak.
    // Talabaning shaxsiy ishi (submission) esa bu qoidadan tashqarida qoladi.
    const isSharedImage =
      /^image\//.test(file.mimeType || "") &&
      file.submissions.length === 0 &&
      file.submissionFiles.length === 0;

    const allowed =
      isPublicMaterial || isOwnSubmission || isSharedImage || isStaff(req.user) || file.uploadedById === req.user.id;
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
