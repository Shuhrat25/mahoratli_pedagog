const prisma = require("../db");

async function createUploadedFileRecord(file, userId, db) {
  const user = await (db || prisma).user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!db && user.role === 'STUDENT') {
    const { userTransaction } = require('./securityTransaction');
    return userTransaction(userId, (tx) => createUploadedFileRecord(file, userId, tx));
  }
  db = db || prisma;
  if (user.role === 'STUDENT') {
    const { HttpError } = require('./httpError');
    const usage = await db.uploadedFile.aggregate({ where: { uploadedById: userId }, _sum: { size: true } });
    const quota = Math.max(100, Number(process.env.STUDENT_UPLOAD_QUOTA_MB) || 500) * 1024 * 1024;
    if ((usage._sum.size || 0) + file.size > quota) throw new HttpError(413, 'Fayllar uchun umumiy joy tugadi');
  }
  return db.uploadedFile.create({
    data: {
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: userId,
    },
  });
}

module.exports = { createUploadedFileRecord };
