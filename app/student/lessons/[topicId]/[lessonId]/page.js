"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { topicsApi, fileUrl } from "@/lib/api";
import RichText from "@/components/RichText";
import { useToast } from "@/components/ToastProvider";
import { Icon, paths } from "@/components/icons";

function findNextLesson(topics, topicId, lessonId) {
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  const topicIdx = sorted.findIndex((t) => t.id === topicId);
  const topic = sorted[topicIdx];
  const lessonIdx = topic.lessons.findIndex((l) => l.id === lessonId);
  if (lessonIdx < topic.lessons.length - 1) {
    return { topicId: topic.id, lessonId: topic.lessons[lessonIdx + 1].id };
  }
  const nextTopic = sorted[topicIdx + 1];
  if (nextTopic && nextTopic.lessons.length > 0) {
    return { topicId: nextTopic.id, lessonId: nextTopic.lessons[0].id };
  }
  return null;
}

function formatClock(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LessonPage() {
  const { topicId, lessonId } = useParams();
  const router = useRouter();
  const { error: toastError, success } = useToast();

  const [topics, setTopics] = useState(null);
  const [answers, setAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const submitRef = useRef(null);

  const load = useCallback(
    () =>
      topicsApi.list().then(({ topics }) => {
        setTopics(topics);
        return topics;
      }),
    []
  );

  useEffect(() => {
    setAnswers({});
    setTestResult(null);
    setRemaining(null);
    load();
  }, [topicId, lessonId, load]);

  const topic = topics?.find((t) => t.id === topicId);
  const lesson = topic?.lessons.find((l) => l.id === lessonId);

  // Test uchun vaqt chegarasi: hisob tugaganda javoblar avtomatik yuboriladi.
  useEffect(() => {
    if (!lesson || lesson.type !== "TEST" || !lesson.timeLimitSec || testResult) return;
    setRemaining((prev) => (prev === null ? lesson.timeLimitSec : prev));
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(id);
          submitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lesson?.id, lesson?.type, lesson?.timeLimitSec, testResult]);

  if (!topics) return <div className="text-slate-400">Yuklanmoqda...</div>;
  if (!topic || !lesson) return <p>Dars topilmadi.</p>;
  if (topic.locked || lesson.locked) {
    router.replace(`/student/lessons/${topicId}`);
    return null;
  }

  async function markDone() {
    try {
      await topicsApi.completeLesson(topicId, lessonId);
      await load();
    } catch (err) {
      toastError(err.message || "Xatolik yuz berdi");
    }
  }

  async function goNext() {
    const fresh = await load();
    const next = findNextLesson(fresh, topicId, lessonId);
    if (next) router.push(`/student/lessons/${next.topicId}/${next.lessonId}`);
    else router.push("/student/lessons");
  }

  async function handleNextClick() {
    if (lesson.type === "TEST" && !lesson.done) {
      toastError("Keyingi darsga o'tish uchun testdan o'tish balini oling");
      return;
    }
    if (!lesson.done) await markDone();
    await goNext();
  }

  function toggleAnswer(question, optionId) {
    setAnswers((prev) => {
      if (!question.multiple) return { ...prev, [question.id]: optionId };
      const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [question.id]: next };
    });
  }

  function isChosen(question, optionId) {
    const value = answers[question.id];
    return Array.isArray(value) ? value.includes(optionId) : value === optionId;
  }

  async function submitTest(e) {
    e?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await topicsApi.submitTest(topicId, lessonId, answers);
      setTestResult(result);
      setRemaining(null);
      await load();
      if (result.passed) success(`Test topshirildi — ${result.score}%`);
    } catch (err) {
      toastError(err.message || "Testni yuborib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  }
  submitRef.current = submitTest;

  function retryTest() {
    setTestResult(null);
    setAnswers({});
    setRemaining(lesson.timeLimitSec || null);
  }

  const attemptsLeft = lesson.maxAttempts ? Math.max(0, lesson.maxAttempts - (lesson.attempts || 0)) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold sm:text-xl">{lesson.title}</h1>
          {lesson.done && (
            <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Tugatilgan{lesson.score != null && ` — ${lesson.score}%`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/student/lessons/${topicId}`)}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon path={paths.lessons} className="h-4 w-4" /> Mavzular ro&apos;yxati
          </button>
          <button
            onClick={handleNextClick}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Keyingi dars <Icon path={paths.chevronRight} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {lesson.type === "LIVE" && <LiveLesson lesson={lesson} onJoin={markDone} />}

      {lesson.type === "VIDEO" && (
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-sm">
            <iframe src={lesson.videoUrl} title={lesson.title} className="h-full w-full" allowFullScreen />
          </div>
          {lesson.content && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <RichText value={lesson.content} className="leading-relaxed text-slate-700 dark:text-slate-300" />
            </div>
          )}
        </div>
      )}

      {lesson.type === "TEXT" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RichText value={lesson.content} className="leading-relaxed text-slate-700 dark:text-slate-300" />
          {!lesson.done && (
            <button
              onClick={markDone}
              className="mt-5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Tugatildi deb belgilash
            </button>
          )}
        </div>
      )}

      {lesson.materials?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-bold">Dars materiallari</h3>
          <ul className="space-y-1">
            {lesson.materials.map((m) => (
              <li key={m.id}>
                <a href={fileUrl(m.fileId)} className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  <Icon path={paths.download} className="h-4 w-4" /> {m.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lesson.type === "TEST" && (
        <form onSubmit={submitTest} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
              <span>{lesson.questions.length} savol</span>
              <span>O&apos;tish balli: <b>{lesson.passScore}%</b></span>
              {lesson.maxAttempts && (
                <span>
                  Urinishlar: <b>{lesson.attempts || 0}</b> / {lesson.maxAttempts}
                </span>
              )}
            </div>
            {remaining !== null && !testResult && (
              <span
                className={`rounded-full px-3 py-1 font-bold tabular-nums ${
                  remaining <= 60
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                ⏱ {formatClock(remaining)}
              </span>
            )}
          </div>

          {lesson.questions.map((q, qi) => {
            const result = testResult?.results.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-1 font-semibold">
                  {qi + 1}. {q.text}
                </p>
                {q.multiple && (
                  <p className="mb-2 text-xs font-medium text-indigo-500">Bir nechta to&apos;g&apos;ri javob bor</p>
                )}
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isCorrect = result?.correctOptionIds?.includes(opt.id);
                    const chosen = isChosen(q, opt.id);
                    const isWrongPick = result && chosen && !isCorrect;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                          isCorrect
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
                            : isWrongPick
                            ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20"
                            : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"
                        }`}
                      >
                        <input
                          type={q.multiple ? "checkbox" : "radio"}
                          name={q.id}
                          disabled={!!testResult}
                          checked={chosen}
                          onChange={() => toggleAnswer(q, opt.id)}
                          className="accent-indigo-600"
                        />
                        {opt.text}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!testResult ? (
            <button
              type="submit"
              disabled={submitting || attemptsLeft === 0}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {attemptsLeft === 0 ? "Urinishlar tugadi" : submitting ? "Yuborilmoqda..." : "Testni yakunlash"}
            </button>
          ) : (
            <div
              className={`rounded-2xl border p-4 text-sm font-medium ${
                testResult.passed
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                  : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
              }`}
            >
              <p>
                Natija: <span className="font-bold">{testResult.correctCount}</span> / {testResult.total} to&apos;g&apos;ri javob (
                {testResult.score}%)
              </p>
              <p className="mt-1">
                {testResult.passed
                  ? "✓ O'tish balli olindi — keyingi dars ochildi."
                  : `O'tish uchun kamida ${testResult.passScore}% kerak. Keyingi dars hali ochilmadi.`}
              </p>
              {!testResult.passed && (testResult.maxAttempts === null || testResult.attempts < testResult.maxAttempts) && (
                <button type="button" onClick={retryTest} className="mt-3 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                  Qayta urinish
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/** Jonli dars kartasi — vaqti va uchrashuvga kirish tugmasi. */
function LiveLesson({ lesson, onJoin }) {
  const startsAt = lesson.startsAt ? new Date(lesson.startsAt) : null;
  const now = Date.now();
  const started = !startsAt || startsAt.getTime() <= now;
  // Dars boshlanishiga 15 daqiqa qolganda kirish tugmasi faollashadi.
  const canJoin = !startsAt || startsAt.getTime() - now <= 15 * 60 * 1000;

  return (
    <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm dark:border-rose-900/50 dark:from-rose-950/30 dark:to-slate-900">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
        <span className="relative flex h-2.5 w-2.5">
          {started && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        Jonli dars
      </div>

      {startsAt && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Boshlanish vaqti: <b>{startsAt.toLocaleString("uz-UZ")}</b>
          {!started && " — hali boshlanmadi"}
        </p>
      )}

      {lesson.content && <RichText value={lesson.content} className="mb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300" />}

      <a
        href={canJoin ? lesson.meetingUrl : undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => canJoin && onJoin?.()}
        aria-disabled={!canJoin}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white ${
          canJoin ? "bg-rose-600 hover:bg-rose-700" : "pointer-events-none bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M15 10l4.5-2.5v9L15 14M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
        {canJoin ? "Darsga qo'shilish" : "Dars boshlanishidan 15 daqiqa oldin ochiladi"}
      </a>
    </div>
  );
}
