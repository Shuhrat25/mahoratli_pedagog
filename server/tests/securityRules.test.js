const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'isolated-security-rules-key-not-a-real-secret';
const jwt = require('jsonwebtoken');
const { verifyToken, signToken } = require('../src/lib/jwt');
const { referencesFile } = require('../src/lib/fileAccess');
const { createSession, placePiece, requireSolved, gridFor } = require('../src/lib/puzzleSession');
const { requireStartedAttempt } = require('../src/lib/testAttempt');

test('legacy cookies and verification tokens cannot authenticate as sessions', () => {
  assert.throws(() => verifyToken(jwt.sign({ sub: 'fixture' }, process.env.JWT_SECRET)));
  assert.throws(() => verifyToken(jwt.sign({ sub: 'fixture', tv: 0, type: 'email-verified' }, process.env.JWT_SECRET)));
  assert.equal(verifyToken(signToken({ id: 'fixture', role: 'STUDENT', tokenVersion: 3 })).tv, 3);
});

test('file reference requires exact image src, not arbitrary text or ID prefix', () => {
  assert.equal(referencesFile('private-id', 'private-id'), false);
  assert.equal(referencesFile('<a href="/api/files/private-id">link</a>', 'private-id'), false);
  assert.equal(referencesFile('<img src="/api/files/private-id-extra">', 'private-id'), false);
  assert.equal(referencesFile('<img src="/api/files/private-id">', 'private-id'), true);
  assert.equal(referencesFile('<img src="https://site.invalid/api/files/public/private-id">', 'private-id'), true);
});

test('puzzle solve requires all server-issued pieces from this attempt', () => {
  const session = createSession('EASY', 1);
  assert.throws(() => requireSolved(session, session.id));
  assert.throws(() => placePiece(session, { sessionId: 'other', pieceId: session.pieces[0], x: 0, y: 0 }));
  assert.throws(() => placePiece(session, { sessionId: session.id, pieceId: session.pieces[0], x: 99, y: 0 }));
  session.pieces.forEach((pieceId, index) => placePiece(session, { sessionId: session.id, pieceId, x: index % session.cols, y: Math.floor(index / session.cols) }));
  requireSolved(session, session.id);
  placePiece(session, { sessionId: session.id, pieceId: session.pieces[0], x: 0, y: 0 });
  assert.equal(session.placed.length, session.pieces.length);
  assert.throws(() => requireSolved(session, createSession('EASY', 1).id));
});

test('server grid agrees with the displayed board at every difficulty', async () => {
  const client = await import('../../lib/jigsaw.js');
  for (const level of client.DIFFICULTIES) for (const aspect of [0.5, 0.7, 1, 1.777, 2.2]) {
    assert.deepEqual(gridFor(level.pieces, aspect), client.gridFor(level.pieces, aspect));
  }
  assert.throws(() => createSession('EASY', NaN));
  assert.throws(() => createSession('EASY', 100));
});

test('even unlimited tests require a registered attempt', () => {
  assert.throws(() => requireStartedAttempt(null));
  assert.throws(() => requireStartedAttempt({ testStartedAt: null }));
  requireStartedAttempt({ testStartedAt: new Date() });
});
