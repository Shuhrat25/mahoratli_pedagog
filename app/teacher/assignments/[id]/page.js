"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, fileUrl } from "@/lib/api";
import Modal from "@/components/Modal";
import { Icon, paths } from "@/components/icons";

export default function TeacherAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [grading, setGrading] = useState(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");

  function reload() {
    return assignmentsApi.get(id).then(({ assignment }) => setAssignment(assignment));
  }

  useEffect(() => {
    reload();
  }, [id]);

  if (!assignment) return <div className="text-slate-400">Yuklanmoqda...</div>;

  function openGrade(sub) {
    setGrading(sub);
    setScore(sub.score ?? "");
    setComment(sub.comment || "");
  }

  async function saveGrade(e) {
    e.preventDefault();
    await assignmentsApi.grade(id, grading.id, { score: Number(score), comment });
    await reload();
    setGrading(null);
  }

  return (
    <div>
      <button onClick={() => router.push("/teacher/assignments")} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Vazifalar
      </button>

      <h1 className="mb-1 text-xl font-semibold">{assignment.title}</h1>
      <p className="mb-4 text-sm text-slate-500">
        Maksimal baho: {assignment.maxScore} · Muddat: {new Date(assignment.dueDate).toLocaleString("uz-UZ")}
      </p>

      <div className="card mb-4 p-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">{assignment.description}</p>
      </div>

      <h2 className="mb-2 font-semibold">Ishtirokchilar javoblari</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Ism</th>
              <th className="px-4 py-3">Fayl</th>
              <th className="px-4 py-3">Ball</th>
              <th className="px-4 py-3">Holat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assignment.submissions.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                <td className="px-4 py-3 font-medium">{s.studentName}</td>
                <td className="px-4 py-3 text-brand-700 dark:text-brand-400">
                  <a href={fileUrl(s.fileId)} className="inline-flex items-center gap-1 hover:underline">
                    <Icon path={paths.download} className="h-4 w-4" /> {s.fileName}
                  </a>
                </td>
                <td className="px-4 py-3">{s.score ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`badge ${
                      s.status === "REVIEWED"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {s.status === "REVIEWED" ? "Tekshirilgan" : "Tekshirilmagan"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openGrade(s)} className="text-sm text-brand-700 hover:underline dark:text-brand-400">
                    Baholash
                  </button>
                </td>
              </tr>
            ))}
            {assignment.submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Hali javob yuborilmagan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!grading} onClose={() => setGrading(null)} title="Baholash">
        {grading && (
          <form onSubmit={saveGrade} className="space-y-3">
            <p className="text-sm text-slate-500">{grading.studentName} — {grading.fileName}</p>
            <div>
              <label className="label">Ball (max {assignment.maxScore})</label>
              <input type="number" max={assignment.maxScore} min={0} value={score} onChange={(e) => setScore(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Izoh (ixtiyoriy)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input" rows={3} />
            </div>
            <button type="submit" className="btn-primary w-full">
              Saqlash
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
