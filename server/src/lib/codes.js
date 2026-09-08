const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function hashCode(code) {
  return bcrypt.hash(code, 8);
}

async function verifyCode(code, hash) {
  return bcrypt.compare(code, hash);
}

function expiryDate() {
  return new Date(Date.now() + CODE_TTL_MS);
}

module.exports = { generateCode, hashCode, verifyCode, expiryDate };
