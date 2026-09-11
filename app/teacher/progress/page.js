"use client";

import { useEffect, useMemo, useState } from "react";
import { topicsApi, assignmentsApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

// Talabalar taraqqiyoti — kim qaysi darsda turibdi.
//
// LessonProgress yozuvlari ilgari ham to'planardi, lekin o'qituvchi ularni
// hech qayerda ko'ra olmasdi: "kim qayerda qotib qolgan" degan savolga javob
// yo'q edi.

export default function TeacherProgressPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("percent");

  useEffect(() => {
    topicsApi
      .progress()
      .then(setData)
      .catch(() => setData({ lessons: [], rows: [] }));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    let list = data.rows;
    if (term) {
      list = list.filter((r) =>
        `${r.student.firstName} ${r.student.lastName} ${r.student.email}`.toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return `${a.student.firstName}`.localeCompare(`${b.student.firstName}`, "uz");
      if (sort === "score") return (b.averageScore ?? -1) - (a.averageScore ?? -1);
      return b.percent - a.percent;
    });
  }, [data, search, sort]);

  if (!data) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const totalLessons = data.lessons.length;
  const avgPercent = rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : 0;
  const finished = rows.filter((r) => totalLessons > 0 && r.doneCount === totalLessons).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Talabalar taraqqiyoti</h1>
        <a href={assignmentsApi.exportUrl()} className="btn-secondary" download>
          <Icon path={paths.download} className="h-4 w-4" /> Baholarni yuklab olish (CSV)
        </a>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Jami darslar" value={totalLessons} />
        <SummaryCard label="O'rtacha bajarilish" value={`${avgPercent}%`} />
        <SummaryCard label="Kursni tugatganlar" value={`${finished} / ${rows.length}`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Talabani qidirish..." className="input pl-9" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto">
          <option value="percent">Bajarilish bo&apos;yicha</option>
          <option value="score">O&apos;rtacha ball bo&apos;yicha</option>
          <option value="name">Ism bo&apos;yicha</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Talaba</th>
              <th className="px-4 py-3">Bajarildi</th>
              <th className="px-4 py-3 w-[28%]">Taraqqiyot</th>
              <th className="px-4 py-3">Hozir qayerda</th>
              <th className="px-4 py-3">O&apos;rtacha test</th>
              <th className="px-4 py-3">Ball</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {r.student.firstName} {r.student.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{r.student.email}</p>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {r.doneCount} / {totalLessons}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.percent === 100 ? "bg-emerald-500" : r.percent >= 50 ? "bg-brand-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${r.percent}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500">{r.percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {r.currentLesson ? (
                    <span title={r.currentLesson.topicTitle}>{r.currentLesson.title}</span>
                  ) : (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Kursni tugatgan</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{r.averageScore != null ? `${r.averageScore}%` : "—"}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{r.student.points}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Talaba topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
