const fs = require("fs/promises");
const path = require("path");

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (ext === ".txt") {
    return buffer.toString("utf-8");
  }

  throw new Error("Qo'llab-quvvatlanmaydigan fayl turi (faqat DOCX, PDF yoki TXT)");
}

module.exports = { extractText };
