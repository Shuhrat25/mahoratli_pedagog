const test = require("node:test");
const assert = require("node:assert/strict");

const { parseTestMarkup } = require("../src/lib/testMarkup");
const { toCsv } = require("../src/lib/csv");
const { validatePassword } = require("../src/lib/constants");
const { toHttpError, HttpError } = require("../src/lib/httpError");
const { rateLimit } = require("../src/lib/rateLimit");

test("testMarkup: ~ to'g'ri, == noto'g'ri, ++++ ajratuvchi", () => {
  const raw = ["Poytaxt qayer?", "~Toshkent", "==Samarqand", "++++", "2+2=?", "==3", "~4"].join("\n");
  const questions = parseTestMarkup(raw);

  assert.equal(questions.length, 2);
  assert.equal(questions[0].text, "Poytaxt qayer?");
  assert.deepEqual(
    questions[0].options.map((o) => [o.text, o.correct]),
    [
      ["Toshkent", true],
      ["Samarqand", false],
    ]
  );
  assert.equal(questions[1].options.find((o) => o.correct).text, "4");
});

test("testMarkup: bitta savolda bir nechta to'g'ri javob bo'lishi mumkin", () => {
  const raw = ["Qaysilari sonlar?", "~1", "~2", "==olma"].join("\n");
  const [question] = parseTestMarkup(raw);
  assert.equal(question.options.filter((o) => o.correct).length, 2);
});

test("testMarkup: variantsiz blok savol sifatida qabul qilinmaydi", () => {
  assert.equal(parseTestMarkup("Shunchaki matn, variantlarsiz").length, 0);
});

test("csv: ajratuvchi va qo'shtirnoq to'g'ri ekranlanadi", () => {
  const csv = toCsv([
    ["Ism", "Izoh"],
    ["Aziza", 'u "yaxshi" dedi; keyin'],
  ]);
  assert.ok(csv.startsWith("﻿"), "Excel uchun BOM bo'lishi kerak");
  assert.ok(csv.includes('"u ""yaxshi"" dedi; keyin"'));
});

test("parol talablari", () => {
  assert.ok(validatePassword("1"), "qisqa parol rad etilishi kerak");
  assert.ok(validatePassword("parolparol"), "raqamsiz parol rad etilishi kerak");
  assert.ok(validatePassword("12345678"), "harfsiz parol rad etilishi kerak");
  assert.equal(validatePassword("parol1234"), null);
});

test("Prisma xatolari tushunarli HTTP statusga aylanadi", () => {
  assert.equal(toHttpError({ code: "P2025" }).status, 404);
  const conflict = toHttpError({ code: "P2002", meta: { target: ["email"] } });
  assert.equal(conflict.status, 409);
  assert.match(conflict.message, /pochta/);
  assert.equal(toHttpError({ code: "P2003" }).status, 400);
  assert.equal(toHttpError(new Error("boshqa xato")), null);
  assert.equal(toHttpError(new HttpError(403, "yo'q")).status, 403);
});

test("rateLimit: chegaradan keyin 429 qaytaradi", () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2, keyPrefix: `test-${Math.random()}` });
  const req = { headers: {}, socket: { remoteAddress: "1.2.3.4" } };

  function call() {
    let status = 200;
    let nextCalled = false;
    const res = {
      set() {},
      status(code) {
        status = code;
        return this;
      },
      json() {
        return this;
      },
    };
    limiter(req, res, () => {
      nextCalled = true;
    });
    return { status, nextCalled };
  }

  assert.equal(call().nextCalled, true);
  assert.equal(call().nextCalled, true);
  const third = call();
  assert.equal(third.nextCalled, false);
  assert.equal(third.status, 429);
});
