const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'isolated-security-test-key-not-a-real-secret';

// Isolated DB double: no production connection, users, cookies or mail.
let state, trace;
const clone = (value) => structuredClone(value);
const db = {
  user: {
    async findUnique({ where }) { return clone(state.users[where.id]); },
    async findMany() { return Object.values(state.users).map(clone); },
    async update({ where, data }) {
      trace.push(data.points?.increment === 0 ? 'lock' : 'points');
      const u = state.users[where.id];
      if (data.points?.increment) u.points += data.points.increment;
      if (data.points?.decrement) u.points -= data.points.decrement;
      if (data.tokenVersion) u.tokenVersion += data.tokenVersion.increment;
      if (data.passwordHash) u.passwordHash = data.passwordHash;
      return clone(u);
    },
  },
  assignment: {
    async findUnique() { return clone({ ...state.assignment, submissions: state.submission ? [{ ...state.submission, student: state.users.student, files: [], file: null }] : [] }); },
  },
  submission: {
    async findUnique() { trace.push('read-attempt'); return clone(state.submission); },
    async update({ data }) { Object.assign(state.submission, data); return clone(state.submission); },
    async upsert({ update, create }) {
      state.submission = state.submission ? { ...state.submission, ...update } : { id: 'submission', creditedPoints: 0, attempts: 0, score: null, ...create };
      return clone(state.submission);
    },
  },
  submissionFile: { async deleteMany() {}, async createMany() {} },
  topic: { async findMany() { return [{ id: 'topic', lessons: [clone(state.lesson)] }]; } },
  lesson: { async findUnique() { return clone(state.lesson); } },
  lessonProgress: {
    async findMany() { return state.progress ? [clone(state.progress)] : []; },
    async findUnique() { return clone(state.progress); },
    async upsert({ update, create }) { state.progress = state.progress ? { ...state.progress, ...update } : { id: 'progress', attempts: 0, ...create }; return clone(state.progress); },
    async update({ data }) { Object.assign(state.progress, data); return clone(state.progress); },
  },
  uploadedFile: { async aggregate() { return { _sum: { size: 0 } }; }, async create({ data }) { return { id: 'testfile', ...data }; } },
  gradeAudit: { async create({ data }) { state.audit.push(clone(data)); } },
  notification: { async create() {}, async createMany() {} },
  post: { async findFirst() { return null; } },
  postLike: { async create() { throw new Error('Unauthorized write'); } },
  comment: { async create() { throw new Error('Unauthorized write'); } },
  emailVerification: {
    async updateMany({ where, data }) {
      if (!state.verification || where.id !== state.verification.id || state.verification.consumedAt || where.email !== state.verification.email) return { count: 0 };
      Object.assign(state.verification, data); return { count: 1 };
    },
  },
  async $transaction(work) {
    const snapshot = clone(state);
    try { return await work(db); }
    catch (err) { state = snapshot; throw err; }
  },
};
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
const assignments = require('../src/routes/assignments');
const posts = require('../src/routes/posts');
const auth = require('../src/routes/auth');
const files = require('../src/routes/files');
const topics = require('../src/routes/topics');
const { signVerifiedEmailToken } = require('../src/lib/jwt');
const { signToken, COOKIE_NAME } = require('../src/lib/jwt');
const { attachUser } = require('../src/middleware/auth');

function reset() {
  trace = [];
  state = {
    users: { student: { id: 'student', role: 'STUDENT', points: 0, tokenVersion: 0 }, teacher: { id: 'teacher', role: 'TEACHER', points: 0, tokenVersion: 0 } },
    assignment: { id: 'assignment', type: 'TEST', maxScore: 100, maxAttempts: 2, timeLimitSec: 60, dueDate: new Date(Date.now() + 3600000), materials: [], steps: [], questions: [{ id: 'question', text: 'Question', options: [{ id: 'right', correct: true }, { id: 'wrong', correct: false }] }] },
    submission: { id: 'submission', assignmentId: 'assignment', studentId: 'student', testStartedAt: null, attempts: 0, creditedPoints: 0, score: null, status: 'NOT_REVIEWED' },
    audit: [],
    lesson: { id: 'lesson', topicId: 'topic', type: 'TEST', timeLimitSec: 60, maxAttempts: 2, passScore: 60, materials: [], puzzleImages: [], questions: [{ id: 'question', options: [{ id: 'right', correct: true }, { id: 'wrong', correct: false }] }] },
    progress: null,
  };
}

function request(router, method, url, body = {}, role = 'STUDENT') {
  const req = { method, url, originalUrl: url, headers: {}, body, query: {}, user: role === 'TEACHER' ? state.users.teacher : state.users.student };
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); } };
    router.handle(req, res, (err) => err ? reject(err) : reject(new Error('Route not found')));
  });
}

test('test API rejects answers before start and without awarding points', async () => {
  reset();
  const result = await request(assignments, 'POST', '/assignment/submit-test', { answers: { question: 'right' } });
  assert.equal(result.status, 409);
  assert.equal(state.users.student.points, 0);
  assert.equal(trace[0], 'lock');
});

test('revoked session no longer attaches a user to HTTP requests', async () => {
  reset();
  const token = signToken(state.users.student);
  state.users.student.tokenVersion = 1;
  const req = { cookies: { [COOKIE_NAME]: token } };
  await attachUser(req, {}, () => {});
  assert.equal(req.user, undefined);
});

test('questions are withheld before start and released without correct flags on start', async () => {
  reset();
  const before = await request(assignments, 'GET', '/assignment');
  assert.deepEqual(before.data.assignment.questions, []);
  assert.equal(before.data.assignment.questionCount, 1);
  const started = await request(assignments, 'POST', '/assignment/start-test');
  assert.equal(started.status, 200);
  assert.equal(started.data.questions.length, 1);
  assert.equal('correct' in started.data.questions[0].options[0], false);
  const resumed = await request(assignments, 'GET', '/assignment');
  assert.equal(resumed.data.assignment.questions.length, 1);
});

test('test replay is rejected; valid attempt awards only once', async () => {
  reset(); state.submission.testStartedAt = new Date();
  const first = await request(assignments, 'POST', '/assignment/submit-test', { answers: { question: 'right' } });
  assert.equal(first.status, 200); assert.equal(state.users.student.points, 100);
  const replay = await request(assignments, 'POST', '/assignment/submit-test', { answers: { question: 'right' } });
  assert.equal(replay.status, 409); assert.equal(state.users.student.points, 100);
  assert.equal(state.submission.attempts, 1); assert.equal(state.audit.length, 1);
});

test('expired submission consumes an attempt and commits before returning 403', async () => {
  reset(); state.submission.testStartedAt = new Date(Date.now() - 120000);
  const result = await request(assignments, 'POST', '/assignment/submit-test', { answers: { question: 'right' } });
  assert.equal(result.status, 403); assert.equal(state.submission.attempts, 1);
  assert.equal(state.submission.testStartedAt, null); assert.equal(state.users.student.points, 0);
});

test('starting after expired last attempt persists exhaustion', async () => {
  reset(); state.assignment.maxAttempts = 1; state.submission.testStartedAt = new Date(Date.now() - 120000);
  assert.equal((await request(assignments, 'POST', '/assignment/start-test')).status, 403);
  assert.equal(state.submission.attempts, 1); assert.equal(state.submission.testStartedAt, null);
});

test('student cannot grade; teacher regrading replaces contribution', async () => {
  reset(); state.submission.score = 80; state.submission.creditedPoints = 80; state.users.student.points = 80;
  assert.equal((await request(assignments, 'PATCH', '/assignment/submissions/submission', { score: 100 })).status, 403);
  assert.equal((await request(assignments, 'PATCH', '/assignment/submissions/submission', { score: 50 }, 'TEACHER')).status, 200);
  assert.equal(state.users.student.points, 50); assert.equal(state.submission.creditedPoints, 50);
  assert.equal(state.audit[0].actorId, 'teacher');
});

test('file resubmission removes previous contribution before regrading', async () => {
  reset(); state.assignment.type = 'FILE'; state.submission.score = 80; state.submission.creditedPoints = 80; state.users.student.points = 80;
  const layer = assignments.stack.find((layer) => layer.route?.path === '/:id/submit');
  const handler = layer.route.stack.at(-1).handle;
  await new Promise((resolve, reject) => handler({ user: state.users.student, params: { id: 'assignment' }, body: {}, files: [{ originalname: 'test.txt', filename: 'isolated.txt', mimetype: 'text/plain', size: 1 }] }, { status() { return this; }, json() { resolve(); } }, reject));
  assert.equal(state.users.student.points, 0); assert.equal(state.submission.score, null);
  await request(assignments, 'PATCH', '/assignment/submissions/submission', { score: 90 }, 'TEACHER');
  assert.equal(state.users.student.points, 90);
});

test('hidden posts cannot be exposed through likes or comments', async () => {
  reset();
  assert.equal((await request(posts, 'POST', '/draft/like')).status, 404);
  assert.equal((await request(posts, 'POST', '/draft/comments', { text: 'hello' })).status, 404);
});

test('reset confirmation can be consumed only once', async () => {
  reset(); state.verification = { id: 'verification', email: 'fixture@example.invalid', consumedAt: null };
  db.user.findUnique = async ({ where }) => clone(where.email ? state.users.student : state.users[where.id]);
  const token = signVerifiedEmailToken(state.verification.email, 'RESET', state.verification.id);
  const body = { email: state.verification.email, newPassword: 'FixturePass123', verifiedToken: token };
  assert.equal((await request(auth, 'POST', '/forgot-password/reset', body)).status, 200);
  assert.equal((await request(auth, 'POST', '/forgot-password/reset', body)).status, 400);
  assert.equal(state.users.student.tokenVersion, 1);
});

test('lesson test starts on server, hides questions beforehand and rejects replay', async () => {
  reset();
  assert.equal((await request(topics, 'POST', '/topic/lessons/lesson/submit-test', { answers: { question: 'right' } })).status, 409);
  const hidden = await request(topics, 'GET', '/');
  assert.deepEqual(hidden.data.topics[0].lessons[0].questions, []);
  const started = await request(topics, 'POST', '/topic/lessons/lesson/start-test');
  assert.equal(started.status, 200); assert.equal(started.data.questions.length, 1);
  const solved = await request(topics, 'POST', '/topic/lessons/lesson/submit-test', { answers: { question: 'right' } });
  assert.equal(solved.status, 200); assert.equal(state.progress.score, 100);
  assert.equal((await request(topics, 'POST', '/topic/lessons/lesson/submit-test', { answers: { question: 'right' } })).status, 409);
  assert.equal(state.progress.attempts, 1);
  assert.equal((await request(topics, 'POST', '/topic/lessons/lesson/start-test')).status, 200);
  const last = await request(topics, 'POST', '/topic/lessons/lesson/submit-test', { answers: { question: 'wrong' } });
  assert.equal(last.status, 200);
  assert.equal(state.progress.score, 0, 'the latest attempt replaces the earlier higher grade');
  assert.equal(state.progress.attempts, 2);
});

test('private teacher image cannot be shared by inserting its ID in student forum', async () => {
  reset();
  db.uploadedFile.findUnique = async () => ({ id: 'private', mimeType: 'image/png', uploadedById: 'teacher', uploadedBy: { role: 'TEACHER' }, submissions: [], submissionFiles: [], materials: [], assignmentMaterials: [], lessonMaterials: [], puzzleImages: [], banners: [], posts: [] });
  db.post.findMany = async () => [];
  db.forumThread = { async findMany() { return [{ body: '<img src="/api/files/private">', authorId: 'student', author: { role: 'STUDENT' } }]; } };
  db.forumReply = { async findMany() { return []; } };
  db.assignment.findMany = async () => [];
  db.assignmentStep = { async findMany() { return []; } };
  db.lesson = { async findMany() { return []; } };
  assert.equal((await request(files, 'GET', '/private')).status, 403);
});
