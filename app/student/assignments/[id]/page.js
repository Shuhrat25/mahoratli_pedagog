"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, fileUrl } from "@/lib/api";
import RichText from "@/components/RichText";
import { Icon, paths } from "@/components/icons";

export default function StudentAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    assignmentsApi.get(id).then(({ assignment }) => setAssignment(assignment));
  }, [id]);

  if (!assignment) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const closed = new Date(assignment.dueDate) < new Date();
  const mySubmission = assignment.submissions[0];

  async function submitTest(e) {
    e.preventDefault();
    const result = await assignmentsApi.submitTest(id, answers);
    setTestResult(result);
  }

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

      {assignment.type === "TEST" ? (
        <form onSubmit={submitTest} className="space-y-4">
          {assignment.questions.map((q, qi) => {
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
                          disabled={!!testResult || closed}
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
            <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              {mySubmission ? "Qayta topshirish" : "Testni yakunlash"}
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
