"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usersApi, assignmentsApi, topicsApi } from "@/lib/api";
import StatCard from "@/components/StatCard";
import RatingWidget from "@/components/RatingWidget";
import { Icon, paths } from "@/components/icons";

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState({ totalStudents: 0, online: 0, visits: [] });
  const [students, setStudents] = useState([]);
  const [openAssignments, setOpenAssignments] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersApi.stats(),
      usersApi.list({ sort: "firstName" }),
      assignmentsApi.list(),
      topicsApi.progress().catch(() => null),
    ])
      .then(([s, u, a, p]) => {
        setStats(s);
        setStudents(u.users.filter((x) => x.role === "STUDENT"));
        setOpenAssignments(a.assignments.filter((x) => new Date(x.dueDate) > new Date()).length);
        setPendingReview(
          a.assignments.reduce((sum, x) => sum + x.submissions.filter((sub) => sub.status === "NOT_REVIEWED").length, 0)
        );
        setProgress(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const avgProgress = progress?.rows?.length
    ? Math.round(progress.rows.reduce((s, r) => s + r.percent, 0) / progress.rows.length)
    : null;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jami o'quvchilar" value={stats.totalStudents} icon={<Icon path={paths.participants} />} />
        <StatCard label="Hozir onlayn" value={stats.online} icon={<Icon path={paths.home} />} />
        <StatCard label="Ochiq vazifalar" value={openAssignments} icon={<Icon path={paths.assignments} />} />
        <Link href="/teacher/assignments" className="block">
          <StatCard label="Tekshirilmagan javoblar" value={pendingReview} icon={<Icon path={paths.check} />} />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Oxirgi oy davomida tashriflar</h2>
              <span className="text-xs text-slate-400">kuniga noyob foydalanuvchilar</span>
            </div>
            <AreaChart data={stats.visits || []} totalStudents={stats.totalStudents} />
          </div>

          {avgProgress !== null && (
            <Link href="/teacher/progress" className="card block p-4 transition-colors hover:border-brand-300">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Kurs bo&apos;yicha o&apos;rtacha taraqqiyot</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Kim qaysi darsda turganini ko&apos;rish</p>
                </div>
                <span className="text-2xl font-bold text-brand-600">{avgProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${avgProgress}%` }} />
              </div>
            </Link>
          )}
        </div>
        <RatingWidget users={students} />
      </div>
    </div>
  );
}

/**
 * Tashriflar grafigi.
 *
 * Ma'lumot endi HAQIQIY — serverdagi DailyActivity yozuvlaridan keladi
 * ({ day, count } ro'yxati). Ilgari bu yerda Math.random() bilan generatsiya
 * qilingan son chizilardi va o'qituvchi uni haqiqiy statistika deb o'qirdi.
 */
function AreaChart({ data, totalStudents = 0 }) {
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 192;
  const padLeft = 30;
  const padBottom = 20;
  const padTop = 10;
  const chartW = width - padLeft;
  const chartH = height - padTop - padBottom;

  if (!data || data.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        Statistika hali yig&apos;ilmoqda — talabalar tizimga kirgani sari grafik to&apos;ladi.
      </p>
    );
  }

  const counts = data.map((d) => d.count);
  const max = Math.max(totalStudents, ...counts, 1);
  const stepX = chartW / (data.length - 1);

  const points = counts.map((v, i) => [padLeft + i * stepX, padTop + chartH - (v / max) * chartH]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${padTop + chartH} L${padLeft},${padTop + chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const xLabelEvery = Math.ceil(data.length / 8);
  const dayNumbers = data.map((d) => Number(d.day.slice(8, 10)));

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((relX - padLeft) / stepX)));
    setHover(idx);
  }

  return (
    <div ref={containerRef} className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-48 w-full overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" className="text-brand-500" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" className="text-brand-500" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => {
          const y = padTop + chartH - (t / max) * chartH;
          return (
            <g key={i}>
              <line x1={padLeft} x2={width} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" className="fill-slate-400">
                {t}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#visitsFill)" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-500" vectorEffect="non-scaling-stroke" />

        {hover !== null && (
          <line
            x1={points[hover][0]}
            x2={points[hover][0]}
            y1={padTop}
            y2={padTop + chartH}
            strokeDasharray="3,3"
            className="stroke-brand-400"
          />
        )}

        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={hover === i ? 4 : 2.5} className="fill-brand-600" vectorEffect="non-scaling-stroke" />
        ))}

        {dayNumbers.map(
          (d, i) =>
            (i % xLabelEvery === 0 || i === dayNumbers.length - 1) && (
              <text key={i} x={points[i][0]} y={height - 4} textAnchor="middle" fontSize="9" className="fill-slate-400">
                {d}
              </text>
            )
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
          style={{ left: `${(points[hover][0] / width) * 100}%`, top: `${(points[hover][1] / height) * 100}%` }}
        >
          {new Date(data[hover].day).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" })}:{" "}
          {data[hover].count} ta foydalanuvchi
        </div>
      )}
    </div>
  );
}
