// Pazl geometriyasi: to'r o'lchami, bo'laklarning "quloqli" (fig'urali)
// qirralari va har bir bo'lakning SVG konturi. Toza funksiyalar — brauzerga
// bog'liq emas, server testlari ham shu faylni import qiladi.

/**
 * Murakkablik darajalari. Talaba o'zi tanlaydi; `pieces` — taxminiy bo'laklar
 * soni (aniq to'r rasm tomonlari nisbatiga qarab tanlanadi).
 * server/src/lib/constants.js dagi PUZZLE_DIFFICULTIES bilan bir xil bo'lishi shart.
 */
export const DIFFICULTIES = [
  { key: "EASY", label: "Oson", pieces: 12 },
  { key: "MEDIUM", label: "O'rta", pieces: 24 },
  { key: "HARD", label: "Qiyin", pieces: 48 },
  { key: "EXPERT", label: "Mutaxassis", pieces: 80 },
];

// Quloq o'lchami va tasodifiy egrilik (bo'lak tomoniga nisbatan).
const TAB = 0.1;
const JITTER = 0.04;

/** Quloq bo'lak chegarasidan qancha chiqib turishi mumkin (tomonga nisbatan). */
export const TAB_EXTENT = 0.36;

/** Takrorlanadigan tasodifiy sonlar (mulberry32) — testlar va bir xil shakllar uchun. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bo'laklar soni `target`ga yaqin va bo'laklar imkon qadar kvadrat bo'ladigan
 * to'r. `aspect` — rasm eni / bo'yi.
 */
export function gridFor(target, aspect) {
  let best = null;
  for (let rows = 2; rows <= target; rows++) {
    const cols = Math.max(2, Math.round(target / rows));
    const pieceAspect = (aspect * rows) / cols;
    const shapePenalty = Math.abs(Math.log(pieceAspect));
    const countPenalty = (Math.abs(rows * cols - target) / target) * 1.5;
    const score = shapePenalty + countPenalty;
    if (!best || score < best.score) best = { rows, cols, score };
  }
  return { rows: best.rows, cols: best.cols };
}

/**
 * Bitta ichki qirra: (0,0) dan (1,0) gacha uchta kubik egri chiziq nuqtalari.
 * [l, w]: l — qirra bo'ylab, w — unga tik (qirra uzunligi va qo'shni tomonga
 * nisbatan). Ishora quloq qaysi bo'lakka chiqishini belgilaydi.
 */
function edgePoints(random) {
  const jitter = () => (random() * 2 - 1) * JITTER;
  const sign = random() < 0.5 ? -1 : 1;
  const a = jitter();
  const b = jitter();
  const c = jitter();
  const d = jitter();
  const e = jitter();
  const t = TAB;
  const p = (l, w) => [l, w * sign];
  return [
    p(0, 0),
    p(0.2, a),
    p(0.5 + b + d, -t + c),
    p(0.5 - t + b, t + c),
    p(0.5 - 2 * t + b - d, 3 * t + c),
    p(0.5 + 2 * t + b - d, 3 * t + c),
    p(0.5 + t + b, t + c),
    p(0.5 + b + e, -t + c),
    p(0.8, e),
    p(1, 0),
  ];
}

/**
 * Barcha ichki qirralar. horizontal[r][c] — r-1 va r qatorlar orasidagi
 * (c ustundagi) qirra; vertical[r][c] — c-1 va c ustunlar orasidagi qirra.
 * Qo'shni ikki bo'lak AYNAN bir xil nuqtalardan foydalanadi, shuning uchun
 * ular bir-biriga millimetrigacha mos tushadi.
 */
export function generateEdges(rows, cols, random = Math.random) {
  const horizontal = [];
  const vertical = [];
  for (let r = 0; r < rows; r++) {
    horizontal[r] = [];
    vertical[r] = [];
    for (let c = 0; c < cols; c++) {
      horizontal[r][c] = r > 0 ? edgePoints(random) : null;
      vertical[r][c] = c > 0 ? edgePoints(random) : null;
    }
  }
  return { horizontal, vertical };
}

const round = (n) => Math.round(n * 100) / 100;

function curves(points) {
  // points[0] — joriy nuqta, qolgan 9 tasi uchta "C" buyrug'iga bo'linadi.
  let d = "";
  for (let i = 1; i < points.length; i += 3) {
    const [c1, c2, end] = [points[i], points[i + 1], points[i + 2]];
    d += ` C ${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(end[0])} ${round(end[1])}`;
  }
  return d;
}

/**
 * (r, c) bo'lagining yopiq konturi — bo'lak katagining chap-yuqori burchagi
 * (0,0) nuqtada, soat mili bo'yicha: yuqori → o'ng → past → chap.
 */
export function piecePath(r, c, { rows, cols }, edges, pw, ph) {
  let d = "M 0 0";

  if (r === 0) d += ` L ${round(pw)} 0`;
  else d += curves(edges.horizontal[r][c].map(([l, w]) => [l * pw, w * ph]));

  if (c === cols - 1) d += ` L ${round(pw)} ${round(ph)}`;
  else d += curves(edges.vertical[r][c + 1].map(([l, w]) => [pw + w * pw, l * ph]));

  if (r === rows - 1) d += ` L 0 ${round(ph)}`;
  else d += curves(edges.horizontal[r + 1][c].map(([l, w]) => [l * pw, ph + w * ph]).reverse());

  if (c === 0) d += " L 0 0";
  else d += curves(edges.vertical[r][c].map(([l, w]) => [w * pw, l * ph]).reverse());

  return `${d} Z`;
}

/** Soniyalarni "1:05" yoki "12:30:07" ko'rinishida. */
export function formatSolveTime(totalSec) {
  if (totalSec == null) return "";
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
