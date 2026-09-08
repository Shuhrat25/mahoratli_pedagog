"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { topicsApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

function topicProgress(topic) {
  if (!topic.lessons.length) return 0;
  const done = topic.lessons.filter((l) => l.done).length;
  return Math.round((done / topic.lessons.length) * 100);
}

export default function StudentLessonsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    topicsApi
      .list()
      .then(({ topics }) => setTopics([...topics].sort((a, b) => a.order - b.order)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const totalLessons = topics.reduce((sum, t) => sum + t.lessons.length, 0);
  const doneLessons = topics.reduce((sum, t) => sum + t.lessons.filter((l) => l.done).length, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Mavzular</h1>
          <div className="mt-1.5 flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Icon path={paths.lessons} className="h-4 w-4 text-indigo-500" />
              {totalLessons} ta dars
            </span>
            <span className="flex items-center gap-1.5">
              <Icon path={paths.check} className="h-4 w-4 text-emerald-500" />
              {doneLessons} bajarildi
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {topics.map((topic) => {
          const pct = topicProgress(topic);
          const content = (
            <div
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors dark:bg-slate-900 ${
                topic.locked
                  ? "border-slate-200 opacity-60 dark:border-slate-800"
                  : "border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-700"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold">{topic.title}</h2>
                    {topic.locked && <Icon path={paths.lock} className="h-4 w-4 shrink-0 text-slate-400" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{topic.lessons.length} dars</p>
                </div>
                <span
                  className={`shrink-0 text-lg font-extrabold ${
                    pct === 100 ? "text-emerald-500" : pct > 0 ? "text-indigo-500" : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
          return topic.locked ? (
            <div key={topic.id}>{content}</div>
          ) : (
            <Link key={topic.id} href={`/student/lessons/${topic.id}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
