"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, fileUrl } from "@/lib/api";
import RichText from "@/components/RichText";
import { useToast } from "@/components/ToastProvider";
import { formatDuration, formatClock } from "@/lib/formatDuration";
import { Icon, paths } from "@/components/icons";

/** Vaqt tugaganda ko'rsatiladigan ekran — test yopiladi, savollar ko'rinmaydi. */
function TimeUpCard({ result, submitting, maxScore, onLeave }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
      <p className="text-3xl">⏱</p>
      <h2 className="mt-2 text-lg font-bold">Vaqt tugadi</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Test yakunlandi. Belgilashga ulgurgan javoblaringiz hisobga olindi.
      </p>
      {submitting && <p className="mt-3 text-sm text-slate-500">Javoblar yuborilmoqda...</p>}
      {result && (
        <p className="mt-3 text-base font-semibold">
          Natija: {result.correctCount} / {result.total} to&apos;g&apos;ri javob —{" "}
          <span className="text-rose-700 dark:text-rose-300">
            {result.score} / {result.maxScore ?? maxScore}
          </span>{" "}
          ball
        </p>
      )}
      <button
        onClick={onLeave}
        className="mt-5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Vazifalar ro&apos;yxatiga
      </button>
    </div>
  );
}

export default function StudentAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(null);
  // Tugash vaqti SERVERdan keladi — sahifani yangilash vaqtni qaytarmaydi.
  const [endsAt, setEndsAt] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [startError, setStartError] = useState("");
  const submitRef = useRef(null);
  const closedRef = useRef(false);
  const { error: toastError, success } = useToast();

  useEffect(() => {
    assignmentsApi.get(id).then(({ assignment }) => setAssignment(assignment));
  }, [id]);

  // Testni boshlash: server urinish oynasini ochadi va tugash vaqtini qaytaradi.
  // Vaqt chegarasi yo'q bo'lsa endsAt null bo'ladi va taymer ko'rinmaydi.
  useEffect(() => {
    if (!assignment || assignment.type !== "TEST" || testResult || timedOut) return;
    if (closedRef.current) return;
    let cancelled = false;
    assignmentsApi
      .startTest(assignment.id)
      .then((info) => {
        if (cancelled) return;
        setEndsAt(info.endsAt);
        setStartError("");
      })
      .catch((err) => {
        if (!cancelled) setStartError(err.message || "Testni boshlab bo'lmadi");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id, assignment?.type]);

  // Hisob serverdagi tugash vaqtidan yuritiladi. Nolga yetganda javoblar
  // avtomatik yuboriladi va talaba testdan chiqariladi.
  useEffect(() => {
    if (!endsAt || testResult || timedOut) return;
    function tick() {
      const left = Math.round((new Date(endsAt).getTime() - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setTimedOut(true);
        submitRef.current?.({ auto: true });
        return true;
      }
      setRemaining(left);
      return false;
    }
    if (tick()) return;
    const timer = setInterval(() => {
      if (tick()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt, testResult, timedOut]);

  if (!assignment) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const closed = new Date(assignment.dueDate) < new Date();
  closedRef.current = closed;
  const mySubmission = assignment.submissions[0];
  const usedAttempts = mySubmission?.attempts || 0;
  const attemptsLeft = assignment.maxAttempts ? Math.max(0, assignment.maxAttempts - usedAttempts) : null;

  function toggleAnswer(question, optionId) {
    setAnswers((prev) => {
      if (!question.multiple) return { ...prev, [question.id]: optionId };
      const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
      const next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
      return { ...prev, [question.id]: next };
    });
  }

  function isChosen(question, optionId) {
    const value = answers[question.id];
    return Array.isArray(value) ? value.includes(optionId) : value === optionId;
  }

  async function submitTest(e) {
    const auto = e?.auto === true;
    if (!auto) e?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await assignmentsApi.submitTest(id, answers);
      setTestResult(result);
      setRemaining(null);
      const { assignment: fresh } = await assignmentsApi.get(id);
      setAssignment(fresh);
      if (auto) {
        toastError(`Vaqt tugadi — javoblaringiz yuborildi: ${result.score}/${result.maxScore} ball`);
      } else {
        success(`Test topshirildi — ${result.score}/${result.maxScore} ball`);
      }
    } catch (err) {
      toastError(err.message || "Testni yuborib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  }
  submitRef.current = submitTest;

  return (
    <div>
      <button onClick={() => router.push("/student/assignments")} className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Vazifalar
      </button>

      <h1 className="mb-2 text-2xl font-extrabold">{assignment.title}</h1>
      <p className="mb-5 text-sm text-slate-500">
        Maksimal baho: {assignment.maxScore} · Muddat: {new Date(assignment.dueDate).toLocaleString("uz-UZ")}
        {closed && " · Yopilgan"}
      </p>

      {assignment.description && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RichText value={assignment.description} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300" />
        </div>
      )}

      {assignment.steps?.length > 0 && (
        <div className="mb-4 space-y-3">
          {assignment.steps.map((s, i) => (
            <div key={s.id || i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <RichText value={s.text} className="mt-1 text-sm text-slate-600 dark:text-slate-400" />
            </div>
          ))}
        </div>
      )}

      {assignment.materials?.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-bold">Materiallar</h3>
          <ul className="space-y-1">
            {assignment.materials.map((m) => (
              <li key={m.id}>
                <a
                  href={fileUrl(m.fileId)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <Icon path={paths.download} className="h-4 w-4" /> {m.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assignment.type === "TEST" && timedOut ? (
        <TimeUpCard
          result={testResult}
          submitting={submitting}
          maxScore={assignment.maxScore}
          onLeave={() => router.push("/student/assignments")}
        />
      ) : assignment.type === "TEST" ? (
        <form onSubmit={submitTest} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
              <span>{assignment.questions.length} savol</span>
              <span>
                Vaqt:{" "}
                <b>{formatDuration(assignment.timeLimitSec) || "cheklanmagan"}</b>
              </span>
              <span>
                Urinishlar:{" "}
                <b>{assignment.maxAttempts ? `${usedAttempts} / ${assignment.maxAttempts}` : "cheksiz"}</b>
              </span>
            </div>
            {startError && <span className="text-xs font-medium text-rose-600">{startError}</span>}
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

          {assignment.questions.map((q, qi) => {
            const result = testResult?.results.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-3 font-semibold">
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
                          disabled={!!testResult || closed}
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
            mySubmission?.status === "REVIEWED" ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium dark:border-indigo-900 dark:bg-indigo-950/40">
                Oldingi natija: <span className="font-bold text-indigo-700 dark:text-indigo-300">{mySubmission.score}</span> /{" "}
                {assignment.maxScore}
              </div>
            ) : null
          ) : (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium dark:border-indigo-900 dark:bg-indigo-950/40">
              Natija: <span className="font-bold text-indigo-700 dark:text-indigo-300">{testResult.correctCount}</span> / {testResult.total}{" "}
              to'g'ri javob — <span className="font-bold text-indigo-700 dark:text-indigo-300">{testResult.score}</span> /{" "}
              {testResult.maxScore} ball
            </div>
          )}

          {!closed && !testResult && (
            <button
              type="submit"
              disabled={submitting || attemptsLeft === 0}
              className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {attemptsLeft === 0
                ? "Urinishlar tugadi"
                : submitting
                ? "Yuborilmoqda..."
                : mySubmission
                ? "Qayta topshirish"
                : "Testni yakunlash"}
            </button>
          )}
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-bold">Bajarilgan ishni yuborish</h3>

          {mySubmission && (
            <div className="mb-4 text-sm">
              <p className="mb-2">
                Holat:{" "}
                {mySubmission.status === "REVIEWED" ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Baholandi — {mySubmission.score}/{assignment.maxScore}
                  </span>
                ) : (
                  <span className="font-medium text-amber-600">Tekshirilmoqda</span>
                )}
              </p>

              {mySubmission.files?.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Yuborilgan fayllar ({mySubmission.files.length})
                  </p>
                  <ul className="space-y-1">
                    {mySubmission.files.map((f) => (
                      <li key={f.id}>
                        <a
                          href={fileUrl(f.fileId)}
                          className="flex items-center gap-2 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <Icon path={paths.download} className="h-4 w-4" /> {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {mySubmission.text && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Izohingiz</p>
                  <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{mySubmission.text}</p>
                </div>
              )}

              {mySubmission.status === "REVIEWED" && mySubmission.comment && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    O&apos;qituvchi izohi
                  </p>
                  <RichText value={mySubmission.comment} className="text-sm text-slate-700 dark:text-slate-300" />
                </div>
              )}
            </div>
          )}

          {!closed && (
            <Link
              href={`/student/assignments/${id}/submit`}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Icon path={paths.upload} className="h-4 w-4" />
              {mySubmission ? "Qayta yuklash" : "Yuklash"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
