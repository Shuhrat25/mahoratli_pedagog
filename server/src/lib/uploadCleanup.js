const fs = require('fs/promises');
const path = require('path');
const prisma = require('../db');
const { referencesFile } = require('./fileAccess');
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

async function removeUnreferencedUpload(storedName) {
  // The filename comes from Multer or the DB, never from a request path.
  if (path.basename(storedName) !== storedName) return;
  const file = await prisma.uploadedFile.findFirst({ where: { storedName }, include: {
    submissions: true, submissionFiles: true, materials: true, assignmentMaterials: true,
    lessonMaterials: true, puzzleImages: true, banners: true, posts: true,
  } });
  if (file) {
    if (['submissions', 'submissionFiles', 'materials', 'assignmentMaterials', 'lessonMaterials', 'puzzleImages', 'banners', 'posts'].some((key) => file[key].length)) return;
    for (const [model, field] of [['forumThread', 'body'], ['forumReply', 'text'], ['post', 'text'], ['lesson', 'content'], ['assignment', 'description'], ['assignmentStep', 'text']]) {
      const rows = await prisma[model].findMany({ where: { [field]: { contains: file.id } }, select: { [field]: true } });
      if (rows.some((row) => referencesFile(row[field], file.id))) return;
    }
    await prisma.uploadedFile.delete({ where: { id: file.id } });
  }
  await fs.unlink(path.join(UPLOAD_DIR, storedName)).catch((err) => { if (err.code !== 'ENOENT') throw err; });
}

async function cleanupStudentUploads() {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const files = await prisma.uploadedFile.findMany({ where: { uploadedBy: { role: 'STUDENT' }, createdAt: { lt: cutoff },
    submissions: { none: {} }, submissionFiles: { none: {} }, materials: { none: {} }, assignmentMaterials: { none: {} },
    lessonMaterials: { none: {} }, puzzleImages: { none: {} }, banners: { none: {} }, posts: { none: {} } }, select: { storedName: true }, take: 500, orderBy: { createdAt: 'asc' } });
  for (const file of files) await removeUnreferencedUpload(file.storedName);
}

module.exports = { removeUnreferencedUpload, cleanupStudentUploads };
