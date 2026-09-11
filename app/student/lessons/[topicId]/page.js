"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { topicsApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

const TYPE_ICON = { VIDEO: paths.lessons, TEXT: paths.materials, TEST: paths.assignments, LIVE: paths.live };
const TYPE_LABEL = { VIDEO: "Video", TEXT: "Matn", TEST: "Test", LIVE: "Jonli dars" };

export default function TopicLessonsPage() {
  const { topicId } = useParams();
  const router = useRouter();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    topicsApi.list().then(({ topics }) => {
      const found = topics.find((t) => t.id === topicId);
      if (!found || found.locked) {
        router.replace("/student/lessons");
        return;
      }
      setTopic(found);
      setLoading(false);
    });
  }, [topicId, router]);

  if (loading || !topic) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const doneCount = topic.lessons.filter((l) => l.done).length;
  const pct = topic.lessons.length ? Math.round((doneCount / topic.lessons.length) * 100) : 0;

  return (
    <div>
      <button
        onClick={() => router.push("/student/lessons")}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
      >
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Mavzular ro'yxati
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{topic.title}</h1>
        <span className={`text-lg font-extrabold ${pct === 100 ? "text-emerald-500" : "text-indigo-500"}`}>{pct}%</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {topic.lessons.map((lesson, idx) => {
          const dotColor = lesson.done
            ? "bg-emerald-500"
            : lesson.locked
            ? "bg-slate-300 dark:bg-slate-700"
            : "bg-amber-400";
          const row = (
            <div
              className={`flex items-center gap-3.5 px-5 py-4 transition-colors ${
                idx !== 0 ? "border-t border-slate-100 dark:border-slate-800" : ""
              } ${lesson.locked ? "opacity-50" : "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"}`}
            >
              <Icon path={TYPE_ICON[lesson.type] || paths.lessons} className="h-5 w-5 shrink-0 text-indigo-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{lesson.title}</p>
                <p className="text-xs text-slate-500">{TYPE_LABEL[lesson.type] || lesson.type}</p>
              </div>
              {lesson.locked ? (
                <Icon path={paths.lock} className="h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
              )}
            </div>
          );
          return lesson.locked ? (
            <div key={lesson.id}>{row}</div>
          ) : (
            <Link key={lesson.id} href={`/student/lessons/${topic.id}/${lesson.id}`}>
              {row}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
