const prisma = require('../db');

// Lock the account before reading its attempts or points. All grade/attempt
// writes use the same lock, including teacher grading and student resubmission.
function userTransaction(userId, work) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { points: { increment: 0 } } });
    return work(tx);
  }, { maxWait: 10000, timeout: 15000 });
}

function gradeFields(value) {
  if (!value) return null;
  return Object.fromEntries(['score', 'creditedPoints', 'points', 'attempts', 'status', 'completed'].filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

async function auditGrade(tx, actorId, studentId, targetId, action, before, after) {
  await tx.gradeAudit.create({ data: {
    actorId, studentId, targetId, action,
    before: JSON.stringify(gradeFields(before)), after: JSON.stringify(gradeFields(after)),
  } });
}

module.exports = { userTransaction, auditGrade };
