// Ketma-ket ochilish mantig'i — serverdagi haqiqiy tekshiruv
// (ТЗ §7: "Инвалидация доступа... должна проверяться и на сервере").

/**
 * topics — order bo'yicha saralangan, har birida lessons (order bo'yicha).
 *
 * Qoida: mavzu oldingi barcha mavzular to'liq tugagandagina ochiladi; mavzu
 * ichida esa darslar birin-ketin ochiladi.
 *
 * Ikkita ilgarigi xato tuzatildi:
 *  1) Darsi yo'q (bo'sh) mavzu "tugallanmagan" hisoblanib, undan keyingi
 *     BARCHA mavzularni abadiy qulflab qo'yardi. Endi bo'sh mavzu zanjirni
 *     to'smaydi.
 *  2) Tekshiruv faqat bevosita oldingi mavzuga qaralardi — o'rtada bo'sh mavzu
 *     bo'lsa, undan oldingi tugallanmagan mavzu "sakrab" o'tib ketardi. Endi
 *     zanjir holati boshidan oxirigacha yig'ib boriladi.
 */
function computeLocks(topics, progressByLessonId) {
  let chainOpen = true; // shu paytgacha bo'lgan hamma narsa tugallangan

  return topics.map((topic) => {
    const topicLocked = !chainOpen;

    const lessons = topic.lessons.map((lesson, lessonIdx) => {
      const previousDone =
        lessonIdx === 0 || !!progressByLessonId.get(topic.lessons[lessonIdx - 1].id)?.completed;
      return {
        ...lesson,
        locked: topicLocked || !previousDone,
        done: !!progressByLessonId.get(lesson.id)?.completed,
        score: progressByLessonId.get(lesson.id)?.score ?? null,
        attempts: progressByLessonId.get(lesson.id)?.attempts ?? 0,
      };
    });

    // Bo'sh mavzu uchun every([]) === true — ya'ni zanjirni to'smaydi.
    chainOpen = chainOpen && lessons.every((l) => l.done);

    return { ...topic, locked: topicLocked, lessons };
  });
}

module.exports = { computeLocks };
