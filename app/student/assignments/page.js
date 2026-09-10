"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assignmentsApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

function formatDue(dueDate) {
  const d = new Date(dueDate);
  return d.toLocaleString("uz-UZ", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "long", year: "numeric" });
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentsApi.list().then(({ assignments }) => setAssignments(assignments)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold">Vazifalar</h1>
      <div className="space-y-3">
        {assignments.map((a) => {
          const closed = new Date(a.dueDate) < new Date();
          const mySubmission = a.submissions[0];
          return (
            <Link
              key={a.id}
              href={`/student/assignments/${a.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-bold">{a.title}</h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    closed
                      ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  {closed ? "Yopilgan" : "Ochiq"}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <Icon path={paths.assignments} className="h-4 w-4 text-indigo-400" />
                {a.type === "TEST" ? `Test · ${a.questions?.length || 0} savol` : "Fayl topshirish"} · Maksimal baho: {a.maxScore}
              </p>
              <p className="mt-1 text-sm text-slate-500">Muddat: {formatDue(a.dueDate)}</p>
              {mySubmission && (
                <p className="mt-2.5 text-sm font-medium">
                  Holat:{" "}
                  <span className={mySubmission.status === "REVIEWED" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>
                    {mySubmission.status === "REVIEWED" ? `Tekshirilgan — ${mySubmission.score} ball` : "Tekshirilmoqda"}
                  </span>
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
