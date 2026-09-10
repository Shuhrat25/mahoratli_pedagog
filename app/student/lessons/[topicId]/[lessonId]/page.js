"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { topicsApi } from "@/lib/api";
import RichText from "@/components/RichText";
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

export default function LessonPage() {
  const { topicId, lessonId } = useParams();
  const router = useRouter();
  const [topics, setTopics] = useState(null);
  const [answers, setAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);

  function load() {
    return topicsApi.list().then(({ topics }) => {
      setTopics(topics);
      return topics;
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, lessonId]);

  if (!topics) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const topic = topics.find((t) => t.id === topicId);
  const lesson = topic?.lessons.find((l) => l.id === lessonId);
  if (!topic || !lesson) return <p>Dars topilmadi.</p>;
  if (topic.locked || lesson.locked) {
    router.replace(`/student/lessons/${topicId}`);
    return null;
  }

  async function markDone() {
    await topicsApi.completeLesson(topicId, lessonId);
    await load();
  }

  async function goNext() {
    const fresh = await load();
    const next = findNextLesson(fresh, topicId, lessonId);
    if (next) router.push(`/student/lessons/${next.topicId}/${next.lessonId}`);
    else router.push("/student/lessons");
  }

  async function handleNextClick() {
    if (!lesson.done) await markDone();
    await goNext();
  }

  async function submitTest(e) {
    e.preventDefault();
    const result = await topicsApi.submitTest(topicId, lessonId, answers);
    setTestResult(result);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h1 className="text-lg font-extrabold sm:text-xl">{lesson.title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/student/lessons/${topicId}`)}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon path={paths.lessons} className="h-4 w-4" /> Mavzular ro'yxati
          </button>
          <button
            onClick={handleNextClick}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Keyingi dars <Icon path={paths.chevronRight} className="h-4 w-4" />
          </button>
        </div>
      </div>

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

      {lesson.type === "TEST" && (
        <form onSubmit={submitTest} className="space-y-4">
          {lesson.questions.map((q, qi) => {
            const result = testResult?.results.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-3 font-semibold">
                  {qi + 1}. {q.text}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isCorrect = result && opt.id === result.correctOptionId;
                    const isWrongPick = result && answers[q.id] === opt.id && opt.id !== result.correctOptionId;
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
                          type="radio"
                          name={q.id}
                          disabled={!!testResult}
                          checked={answers[q.id] === opt.id}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
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
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Testni yakunlash
            </button>
          ) : (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium dark:border-indigo-900 dark:bg-indigo-950/40">
              Natija: <span className="font-bold text-indigo-700 dark:text-indigo-300">{testResult.correctCount}</span> / {testResult.total} to'g'ri javob ({testResult.score}%)
            </div>
          )}
        </form>
      )}
    </div>
  );
}
