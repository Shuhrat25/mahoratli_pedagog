"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, fileUrl } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

export default function StudentAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    assignmentsApi.get(id).then(({ assignment }) => setAssignment(assignment));
  }, [id]);

  if (!assignment) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const closed = new Date(assignment.dueDate) < new Date();
  const mySubmission = assignment.submissions[0];

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await assignmentsApi.submit(id, formData);
      const { assignment: updated } = await assignmentsApi.get(id);
      setAssignment(updated);
    } finally {
      setUploading(false);
    }
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

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{assignment.description}</p>
      </div>

      {assignment.steps?.length > 0 && (
        <div className="mb-4 space-y-3">
          {assignment.steps.map((s, i) => (
            <div key={s.id || i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 font-bold">Bajarilgan ishni yuborish</h3>
        {mySubmission && (
          <p className="mb-3 text-sm">
            Yuborilgan fayl: <span className="font-medium">{mySubmission.fileName}</span> ·{" "}
            {mySubmission.status === "REVIEWED" ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Baholandi: {mySubmission.score}/{assignment.maxScore}
                {mySubmission.comment && ` — "${mySubmission.comment}"`}
              </span>
            ) : (
              <span className="text-amber-600">Tekshirilmoqda</span>
            )}
          </p>
        )}
        {!closed && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon path={paths.upload} className="h-4 w-4" />
            {uploading ? "Yuklanmoqda..." : mySubmission ? "Qayta yuklash" : "Fayl yuklash"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}
