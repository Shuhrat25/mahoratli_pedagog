const prisma = require("../db");

function createUploadedFileRecord(file, userId) {
  return prisma.uploadedFile.create({
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
