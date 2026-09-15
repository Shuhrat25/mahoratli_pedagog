const { PUZZLE_DIFFICULTIES } = require("./constants");

/**
 * Pazlni yig'ish uchun eng kam real vaqt (soniya). Bo'lakni topib, joyiga
 * sudrab qo'yish kamida ~0.4s oladi — bundan tezroq "yig'ilgan" natija
 * so'rovni qo'lda yuborib ball olishga urinish hisoblanadi.
 */
function minSolveSeconds(difficulty) {
  const pieces = PUZZLE_DIFFICULTIES[difficulty];
  if (!pieces) return Infinity;
  return Math.max(5, Math.round(pieces * 0.4));
}

module.exports = { minSolveSeconds };
