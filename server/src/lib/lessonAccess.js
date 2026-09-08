// Ketma-ket ochilish mantig'i — frontenddagi lib/lessonUtils.js bilan bir xil
// qoidalar, lekin bu yerda serverda haqiqiy tekshiruv sifatida ishlatiladi
// (ТЗ §7: "Инвалидация доступа... должна проверяться и на сервере").

function isLessonDoneMap(lessons, progressByLessonId) {
  return lessons.map((l) => !!progressByLessonId.get(l.id)?.completed);
}

function isTopicComplete(lessons, progressByLessonId) {
  if (lessons.length === 0) return false;
  return isLessonDoneMap(lessons, progressByLessonId).every(Boolean);
}

// topics — order bo'yicha saralangan, har birida lessons (order bo'yicha saralangan)
function computeLocks(topics, progressByLessonId) {
  return topics.map((topic, topicIdx) => {
    const topicLocked = topicIdx > 0 && !isTopicComplete(topics[topicIdx - 1].lessons, progressByLessonId);
    const lessons = topic.lessons.map((lesson, lessonIdx) => {
      const lessonLocked = topicLocked || (lessonIdx > 0 && !progressByLessonId.get(topic.lessons[lessonIdx - 1].id)?.completed);
      return { ...lesson, locked: lessonLocked, done: !!progressByLessonId.get(lesson.id)?.completed };
    });
    return { ...topic, locked: topicLocked, lessons };
  });
}

module.exports = { computeLocks, isTopicComplete };
