const { HttpError } = require('./httpError');
const { isExpired } = require('./testWindow');

function requireStartedAttempt(record) {
  if (!record?.testStartedAt) throw new HttpError(409, "Avval testni boshlang. Bu urinish yakunlangan bo'lishi mumkin.");
}

function attemptExpired(record, seconds) {
  requireStartedAttempt(record);
  return isExpired(record.testStartedAt, seconds);
}

module.exports = { requireStartedAttempt, attemptExpired };
