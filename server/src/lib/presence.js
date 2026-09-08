// userId -> ochiq WebSocket ulanishlar soni (bitta foydalanuvchi bir nechta
// tabda ochishi mumkin, shuning uchun sanoq, oddiy boolean emas)
const onlineCounts = new Map();

function markOnline(userId) {
  onlineCounts.set(userId, (onlineCounts.get(userId) || 0) + 1);
}

function markOffline(userId) {
  const count = (onlineCounts.get(userId) || 1) - 1;
  if (count <= 0) onlineCounts.delete(userId);
  else onlineCounts.set(userId, count);
}

function isOnline(userId) {
  return onlineCounts.has(userId);
}

function onlineCount() {
  return onlineCounts.size;
}

module.exports = { markOnline, markOffline, isOnline, onlineCount };
