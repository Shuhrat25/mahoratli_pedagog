const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { computeLocks } = require("../src/lib/lessonAccess");
const { PUZZLE_DIFFICULTIES, LESSON_TYPES } = require("../src/lib/constants");
const { minSolveSeconds } = require("../src/lib/puzzleRules");

// Frontend geometriyasi (lib/jigsaw.js) ESM — dinamik import bilan olamiz.
const JIGSAW = pathToFileURL(path.join(__dirname, "..", "..", "lib", "jigsaw.js")).href;

function topic(id, lessons) {
  return { id, title: id, lessons: lessons.map(([lid, type]) => ({ id: lid, title: lid, type })) };
}

function progress(doneIds) {
  return new Map(doneIds.map((id) => [id, { completed: true, score: null, attempts: 0 }]));
}

test("PUZZLE — dars turlaridan biri", () => {
  assert.ok(LESSON_TYPES.includes("PUZZLE"));
});

test("pazl yig'ilmasa ham keyingi dars ochiladi", () => {
  const topics = [topic("t1", [["l1", "TEXT"], ["p1", "PUZZLE"], ["l2", "TEXT"]])];
  const result = computeLocks(topics, progress(["l1"]));
  const [l1, p1, l2] = result[0].lessons;
  assert.equal(l1.optional, false);
  assert.equal(p1.optional, true);
  assert.equal(p1.locked, false, "pazl oldingi majburiy dars tugagach ochiladi");
  assert.equal(l2.locked, false, "pazl keyingi darsni to'smasligi kerak");
});

test("pazl ham o'z o'rnida ketma-ketlikka bo'ysunadi", () => {
  const topics = [topic("t1", [["l1", "TEST"], ["p1", "PUZZLE"], ["l2", "TEXT"]])];
  const result = computeLocks(topics, progress([]));
  assert.equal(result[0].lessons[1].locked, true, "test o'tilmaguncha pazl ham yopiq");
  assert.equal(result[0].lessons[2].locked, true);
});

test("bir nechta ketma-ket pazl zanjirni uzmaydi", () => {
  const topics = [topic("t1", [["l1", "TEXT"], ["p1", "PUZZLE"], ["p2", "PUZZLE"], ["l2", "TEXT"]])];
  const open = computeLocks(topics, progress(["l1"]));
  assert.deepEqual(open[0].lessons.map((l) => l.locked), [false, false, false, false]);

  const closed = computeLocks(topics, progress([]));
  assert.deepEqual(closed[0].lessons.map((l) => l.locked), [false, true, true, true]);
});

test("mavzu pazlsiz ham tugagan hisoblanadi", () => {
  const topics = [topic("t1", [["l1", "TEXT"], ["p1", "PUZZLE"]]), topic("t2", [["l3", "TEXT"]])];
  const result = computeLocks(topics, progress(["l1"]));
  assert.equal(result[1].locked, false);
});

test("faqat pazldan iborat mavzu keyingi mavzuni to'smaydi", () => {
  const topics = [topic("t1", [["p1", "PUZZLE"]]), topic("t2", [["l2", "TEXT"]])];
  const result = computeLocks(topics, progress([]));
  assert.equal(result[0].lessons[0].locked, false);
  assert.equal(result[1].locked, false);
});

test("yig'ilgan pazl done bo'lib belgilanadi", () => {
  const topics = [topic("t1", [["l1", "TEXT"], ["p1", "PUZZLE"]])];
  const result = computeLocks(topics, progress(["l1", "p1"]));
  assert.equal(result[0].lessons[1].done, true);
});

test("murakkablik darajalari server va frontendda bir xil", async () => {
  const { DIFFICULTIES } = await import(JIGSAW);
  const client = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, d.pieces]));
  assert.deepEqual(client, PUZZLE_DIFFICULTIES);
});

test("eng kam yig'ish vaqti darajaga qarab oshadi, noma'lum daraja qabul qilinmaydi", () => {
  const keys = Object.keys(PUZZLE_DIFFICULTIES);
  const times = keys.map(minSolveSeconds);
  assert.ok(times.every((t) => t >= 5));
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1]);
  assert.equal(minSolveSeconds("NOPE"), Infinity);
});

test("gridFor: bo'laklar soni maqsadga yaqin va bo'laklar kvadratga yaqin", async () => {
  const { gridFor, DIFFICULTIES } = await import(JIGSAW);
  for (const aspect of [0.5, 0.75, 1, 4 / 3, 16 / 9, 2.2]) {
    for (const { pieces } of DIFFICULTIES) {
      const { rows, cols } = gridFor(pieces, aspect);
      assert.ok(rows >= 2 && cols >= 2, `${aspect}/${pieces}: ${cols}x${rows}`);
      assert.ok(Math.abs(rows * cols - pieces) / pieces <= 0.35, `${aspect}/${pieces}: ${cols}x${rows}`);
      const pieceAspect = (aspect * rows) / cols;
      assert.ok(pieceAspect > 0.55 && pieceAspect < 1.8, `${aspect}/${pieces}: bo'lak nisbati ${pieceAspect}`);
    }
  }
  assert.deepEqual(gridFor(12, 4 / 3), { rows: 3, cols: 4 });
});

function numbersOf(segment) {
  const nums = segment.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const points = [];
  for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return points;
}

function curveSection(d, which) {
  // Yo'l: M 0 0, keyin to'rt tomon — har biri "L x y" yoki "C ... C ... C ...".
  const tokens = d.replace(/\s*Z$/, "").split(/(?=[LC])/).slice(1);
  const sides = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].startsWith("L")) {
      sides.push({ type: "L", points: numbersOf(tokens[i]) });
      i += 1;
    } else {
      sides.push({ type: "C", points: numbersOf(tokens.slice(i, i + 3).join(" ")) });
      i += 3;
    }
  }
  return sides[which];
}

test("qo'shni bo'laklarning umumiy qirrasi aynan mos tushadi", async () => {
  const { generateEdges, piecePath, seededRandom } = await import(JIGSAW);
  const grid = { rows: 2, cols: 2 };
  const pw = 120;
  const ph = 90;
  const edges = generateEdges(grid.rows, grid.cols, seededRandom(42));

  // Vertikal: (0,0) ning o'ng tomoni (yuqoridan pastga) va (0,1) ning chap
  // tomoni (pastdan yuqoriga) — bir xil nuqtalar teskari tartibda, pw siljigan.
  const right = curveSection(piecePath(0, 0, grid, edges, pw, ph), 1);
  const left = curveSection(piecePath(0, 1, grid, edges, pw, ph), 3);
  assert.equal(right.type, "C");
  assert.equal(left.type, "C");
  for (let k = 0; k < 8; k++) {
    const [ax, ay] = right.points[k];
    const [bx, by] = left.points[7 - k];
    assert.ok(Math.abs(ax - pw - bx) < 0.02 && Math.abs(ay - by) < 0.02, `vertikal nuqta ${k}`);
  }

  // Gorizontal: (0,0) ning pastki tomoni va (1,0) ning yuqori tomoni.
  const bottom = curveSection(piecePath(0, 0, grid, edges, pw, ph), 2);
  const top = curveSection(piecePath(1, 0, grid, edges, pw, ph), 0);
  for (let k = 0; k < 8; k++) {
    const [ax, ay] = bottom.points[k];
    const [bx, by] = top.points[7 - k];
    assert.ok(Math.abs(ax - bx) < 0.02 && Math.abs(ay - ph - by) < 0.02, `gorizontal nuqta ${k}`);
  }
});

test("chetdagi tomonlar tekis, quloqlar belgilangan chegaradan chiqmaydi", async () => {
  const { generateEdges, piecePath, seededRandom, TAB_EXTENT } = await import(JIGSAW);
  const grid = { rows: 3, cols: 4 };
  const pw = 100;
  const ph = 100;
  const edges = generateEdges(grid.rows, grid.cols, seededRandom(7));

  const corner = piecePath(0, 0, grid, edges, pw, ph);
  assert.equal(curveSection(corner, 0).type, "L", "yuqori chet tekis");
  assert.equal(curveSection(corner, 3).type, "L", "chap chet tekis");

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const nums = piecePath(r, c, grid, edges, pw, ph).match(/-?\d+(?:\.\d+)?/g).map(Number);
      const limit = TAB_EXTENT * 100;
      assert.ok(nums.every((n) => n >= -limit && n <= 100 + limit), `(${r},${c}) chegaradan chiqdi`);
    }
  }
});
