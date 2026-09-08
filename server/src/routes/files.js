const express = require("express");
const path = require("path");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { UPLOAD_DIR } = require("../middleware/upload");

const router = express.Router();

function isStaff(user) {
  return user.role === "TEACHER" || user.role === "ADMIN";
}

router.get("/:id", requireAuth, async (req, res) => {
  const file = await prisma.uploadedFile.findUnique({
    where: { id: req.params.id },
    include: { submissions: true, materials: true, assignmentMaterials: true, banners: true, posts: true },
  });
  if (!file) return res.status(404).json({ error: "Fayl topilmadi" });

  const isPublicMaterial =
    file.materials.length > 0 ||
    file.assignmentMaterials.length > 0 ||
    file.banners.length > 0 ||
    file.posts.length > 0;
  const isOwnSubmission = file.submissions.some((s) => s.studentId === req.user.id);
  const allowed = isPublicMaterial || isOwnSubmission || isStaff(req.user) || file.uploadedById === req.user.id;
  if (!allowed) return res.status(403).json({ error: "Ruxsat yo'q" });

  res.download(path.join(UPLOAD_DIR, file.storedName), file.originalName);
});

module.exports = router;
