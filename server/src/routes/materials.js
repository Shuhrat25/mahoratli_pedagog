const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { createUploadedFileRecord } = require("../lib/uploadedFile");
const { HttpError, route } = require("../lib/httpError");

const router = express.Router();

function shapeMaterial(m) {
  return {
    id: m.id,
    title: m.title,
    fileId: m.file.id,
    type: (m.file.originalName.split(".").pop() || "FILE").toUpperCase(),
    size: `${(m.file.size / (1024 * 1024)).toFixed(1)} MB`,
    uploadedAt: m.uploadedAt,
  };
}

router.get("/", requireAuth, route(async (req, res) => {
  const materials = await prisma.material.findMany({ include: { file: true }, orderBy: { uploadedAt: "desc" } });
  res.json({ materials: materials.map(shapeMaterial) });
}));

router.post("/", requireRole("ADMIN", "TEACHER"), upload.array("files", 20), route(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new HttpError(400, "Fayl talab qilinadi");
  const created = [];
  for (const f of req.files) {
    const file = await createUploadedFileRecord(f, req.user.id);
    const material = await prisma.material.create({
      data: { title: f.originalname.replace(/\.[^.]+$/, ""), fileId: file.id, uploadedById: req.user.id },
      include: { file: true },
    });
    created.push(shapeMaterial(material));
  }
  res.status(201).json({ materials: created });
}));

router.patch("/:id", requireRole("ADMIN", "TEACHER"), route(async (req, res) => {
  const { title } = req.body;
  const material = await prisma.material.update({
    where: { id: req.params.id },
    data: { title },
    include: { file: true },
  });
  res.json({ material: shapeMaterial(material) });
}));

router.delete("/:id", requireRole("ADMIN", "TEACHER"), route(async (req, res) => {
  await prisma.material.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

module.exports = router;
