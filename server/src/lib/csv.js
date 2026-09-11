// CSV yasash — Excel/Google Sheets to'g'ridan-to'g'ri ochadi.
//
// Ikkita nozik joy:
//  - BOM (﻿): Excel usiz UTF-8 ni tanimay, o'zbekcha/kirilcha harflarni
//    buzib ko'rsatadi;
//  - ajratuvchi sifatida nuqtali vergul: ko'p mintaqaviy sozlamalarda (shu
//    jumladan uz/ru) Excel aynan shuni kutadi, oddiy vergul bo'lsa hamma
//    narsa bitta ustunga tushib qoladi.

const DELIMITER = ";";

function escapeCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes('"') || text.includes(DELIMITER) || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  const body = rows.map((row) => row.map(escapeCell).join(DELIMITER)).join("\r\n");
  return `﻿${body}\r\n`;
}

module.exports = { toCsv, DELIMITER };
