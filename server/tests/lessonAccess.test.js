const test = require("node:test");
const assert = require("node:assert/strict");

const { computeLocks } = require("../src/lib/lessonAccess");

function topic(id, lessonIds) {
  return { id, title: id, lessons: lessonIds.map((lid) => ({ id: lid, title: lid, type: "TEXT" })) };
}

function progress(doneIds) {
  return new Map(doneIds.map((id) => [id, { completed: true, score: 100, attempts: 1 }]));
}

test("birinchi mavzuning birinchi darsi doim ochiq", () => {
  const result = computeLocks([topic("t1", ["l1", "l2"])], progress([]));
  assert.equal(result[0].locked, false);
  assert.equal(result[0].lessons[0].locked, false);
  assert.equal(result[0].lessons[1].locked, true);
});

test("dars tugatilgach keyingisi ochiladi", () => {
  const result = computeLocks([topic("t1", ["l1", "l2"])], progress(["l1"]));
  assert.equal(result[0].lessons[1].locked, false);
});

test("mavzu to'liq tugamaguncha keyingi mavzu qulflangan", () => {
  const topics = [topic("t1", ["l1", "l2"]), topic("t2", ["l3"])];
  const partial = computeLocks(topics, progress(["l1"]));
  assert.equal(partial[1].locked, true);

  const full = computeLocks(topics, progress(["l1", "l2"]));
  assert.equal(full[1].locked, false);
});

// Ilgari bo'sh mavzu "tugallanmagan" hisoblanib, undan keyingi BARCHA
// mavzularni abadiy qulflab qo'yardi.
test("darsi yo'q mavzu zanjirni to'smaydi", () => {
  const topics = [topic("t1", ["l1"]), topic("empty", []), topic("t3", ["l3"])];
  const result = computeLocks(topics, progress(["l1"]));
  assert.equal(result[1].locked, false, "bo'sh mavzu ochiq bo'lishi kerak");
  assert.equal(result[2].locked, false, "bo'sh mavzudan keyingisi ham ochiq bo'lishi kerak");
});

// Ikkinchi xato: tekshiruv faqat bevosita oldingi mavzuga qaralardi, shuning
// uchun o'rtadagi bo'sh mavzu tugallanmagan mavzuni "yashirib" yuborardi.
test("bo'sh mavzu tugallanmagan mavzuni yashira olmaydi", () => {
  const topics = [topic("t1", ["l1", "l2"]), topic("empty", []), topic("t3", ["l3"])];
  const result = computeLocks(topics, progress(["l1"])); // t1 tugamagan
  assert.equal(result[1].locked, true, "t1 tugamagani uchun bo'sh mavzu ham qulflangan bo'lishi kerak");
  assert.equal(result[2].locked, true, "t3 ham qulflangan bo'lishi kerak");
});

test("done/score/attempts qiymatlari uzatiladi", () => {
  const result = computeLocks([topic("t1", ["l1"])], progress(["l1"]));
  assert.equal(result[0].lessons[0].done, true);
  assert.equal(result[0].lessons[0].score, 100);
  assert.equal(result[0].lessons[0].attempts, 1);
});
