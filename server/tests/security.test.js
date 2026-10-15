const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-security-secret-key-12345";

const { toCsv } = require("../src/lib/csv");
const { STUDENT_ALLOWED_EXTENSIONS } = require("../src/lib/constants");
const { rateLimit } = require("../src/lib/rateLimit");
const { signToken, verifyToken } = require("../src/lib/jwt");

test("XSS / Extensions: .svg talabalar uchun ruxsat etilgan ro'yxatda yo'q", () => {
  assert.equal(STUDENT_ALLOWED_EXTENSIONS.includes(".svg"), false);
});

test("CSV Injection: formula belgilari (=, +, -, @, \t, \r) oldiga ' qo'yiladi", () => {
  const rows = [
    ["Formula", "Xavf"],
    ["=1+1", "@SUM(A1:A2)"],
    ["+cmd|'/c calc'!A0", "-5"],
    ["\tTabPrefix", "\rCarriagePrefix"],
  ];
  const csv = toCsv(rows);
  assert.ok(csv.includes("'=1+1"));
  assert.ok(csv.includes("'@SUM(A1:A2)"));
  assert.ok(csv.includes("'+cmd|"));
  assert.ok(csv.includes("'-5"));
  assert.ok(csv.includes("'\tTabPrefix"));
});

test("Rate Limit: req.ip xavfsiz olinadi, soxta sarlavha hisobga olinmaydi", () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2, keyPrefix: "sec-test" });
  let nextCalled = 0;
  const mockReq = {
    ip: "203.0.113.195",
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    socket: { remoteAddress: "127.0.0.1" },
  };
  const mockRes = {
    set() {},
    status() { return this; },
    json() { return this; },
  };

  limiter(mockReq, mockRes, () => { nextCalled++; });
  limiter(mockReq, mockRes, () => { nextCalled++; });
  assert.equal(nextCalled, 2);
});

test("JWT: tokenVersion (tv) maydoni mavjud va o'zgarishi aniqlanadi", () => {
  const user = { id: "user_test_123", role: "STUDENT", tokenVersion: 2 };
  const token = signToken(user);
  const payload = verifyToken(token);

  assert.equal(payload.sub, "user_test_123");
  assert.equal(payload.role, "STUDENT");
  assert.equal(payload.tv, 2);
});
