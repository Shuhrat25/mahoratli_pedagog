const crypto = require('crypto');
const { PUZZLE_DIFFICULTIES } = require('./constants');
const { HttpError } = require('./httpError');

function gridFor(target, aspect) {
  let best;
  for (let rows = 2; rows <= target; rows++) {
    const cols = Math.max(2, Math.round(target / rows));
    const score = Math.abs(Math.log(aspect * rows / cols)) + Math.abs(rows * cols - target) / target * 1.5;
    if (!best || score < best.score) best = { rows, cols, score };
  }
  return { rows: best.rows, cols: best.cols };
}

function createSession(difficulty, rawAspect) {
  const aspect = Number(rawAspect);
  if (!Number.isFinite(aspect) || aspect < 0.49 || aspect > 2.21 || !PUZZLE_DIFFICULTIES[difficulty]) throw new HttpError(400, 'Pazl parametrlari noto\'g\'ri');
  const grid = gridFor(PUZZLE_DIFFICULTIES[difficulty], aspect);
  return { id: crypto.randomUUID(), ...grid, pieces: Array.from({ length: grid.rows * grid.cols }, () => crypto.randomUUID()), placed: [] };
}

function placePiece(session, input) {
  if (!session || session.id !== input.sessionId) throw new HttpError(409, 'Pazl urinishi eskirgan');
  const index = session.pieces.indexOf(input.pieceId);
  if (index < 0 || !Number.isFinite(input.x) || !Number.isFinite(input.y)) throw new HttpError(400, 'Bo\'lak noto\'g\'ri');
  const x = index % session.cols, y = Math.floor(index / session.cols);
  if (Math.hypot(input.x - x, input.y - y) > 0.3) throw new HttpError(400, 'Bo\'lak joylashuvi noto\'g\'ri');
  if (!session.placed.includes(input.pieceId)) session.placed.push(input.pieceId);
  return session;
}

function requireSolved(session, id) {
  if (!session || session.id !== id || session.placed.length !== session.pieces.length || new Set(session.placed).size !== session.pieces.length || !session.pieces.every((piece) => session.placed.includes(piece))) {
    throw new HttpError(409, 'Pazl hali to\'liq yig\'ilmagan');
  }
}

module.exports = { gridFor, createSession, placePiece, requireSolved };
