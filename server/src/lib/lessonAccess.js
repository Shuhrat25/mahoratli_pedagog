const { OPTIONAL_LESSON_TYPES } = require("./constants");

function isOptionalLesson(lesson) {
  return OPTIONAL_LESSON_TYPES.includes(lesson.type);
}

/**
 * Darslarning ketma-ket ochilishi.
 *
 * Majburiy dars oldingi MAJBURIY dars tugagach ochiladi. Ixtiyoriy dars (pazl)
 * ham o'z o'rnida shu qoidaga bo'ysunadi, lekin o'zi hech narsani to'smaydi:
 * uni yig'masdan keyingi darsga o'tish mumkin. Mavzu barcha majburiy darslari
 * tugaganda yopilgan hisoblanadi.
 */
function computeLocks(topics, progressByLessonId) {
  let chainOpen = true;
  return topics.map((topic) => {
    const topicLocked = !chainOpen;
    let previousRequiredDone = true;
    const lessons = topic.lessons.map((lesson) => {
      const progress = progressByLessonId.get(lesson.id);
      const optional = isOptionalLesson(lesson);
      const shaped = {
        ...lesson,
        optional,
        locked: topicLocked || !previousRequiredDone,
        done: !!progress?.completed,
        score: progress?.score ?? null,
        attempts: progress?.attempts ?? 0,
      };
      if (!optional) previousRequiredDone = shaped.done;
      return shaped;
    });
    chainOpen = chainOpen && lessons.every((l) => l.optional || l.done);
    return { ...topic, locked: topicLocked, lessons };
  });
}

module.exports = { computeLocks, isOptionalLesson };
