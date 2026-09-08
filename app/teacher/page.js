"use client";

import { useEffect, useMemo, useState } from "react";
import { usersApi, assignmentsApi } from "@/lib/api";
import StatCard from "@/components/StatCard";
import RatingWidget from "@/components/RatingWidget";
import { Icon, paths } from "@/components/icons";

// Demo uchun oxirgi 30 kunlik onlayn o'quvchilar sonini generatsiya qiladi
// (real analitika keyingi bosqichda) — qiymatlar hech qachon jami o'quvchilar
// sonidan oshmasligi kerak, aks holda grafik chap o'qdagi umumiy son bilan
// mos kelmay qoladi.
function generateDemoVisits(totalStudents) {
  const max = Math.max(totalStudents, 1);
  const days = 30;
  return Array.from({ length: days }, (_, i) => {
    const trend = (i / (days - 1)) * 0.6 + 0.2;
    const noise = (Math.random() - 0.5) * 0.3;
    const ratio = Math.min(1, Math.max(0, trend + noise));
    return Math.round(ratio * max);
  });
}

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState({ totalStudents: 0, online: 0 });
  const [students, setStudents] = useState([]);
  const [openAssignments, setOpenAssignments] = useState(0);
  const [loading, setLoading] = useState(true);
  const visits = useMemo(() => generateDemoVisits(stats.totalStudents), [stats.totalStudents]);

  useEffect(() => {
    Promise.all([usersApi.stats(), usersApi.list({ sort: "firstName" }), assignmentsApi.list()])
      .then(([s, u, a]) => {
        setStats(s);
        setStudents(u.users.filter((x) => x.role === "STUDENT"));
        setOpenAssignments(a.assignments.filter((x) => new Date(x.dueDate) > new Date()).length);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Jami o'quvchilar" value={stats.totalStudents} icon={<Icon path={paths.participants} />} />
        <StatCard label="Hozir onlayn" value={stats.online} icon={<Icon path={paths.home} />} />
        <StatCard label="Ochiq vazifalar" value={openAssignments} icon={<Icon path={paths.assignments} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card p-4">
          <h2 className="mb-4 font-semibold">Oxirgi oy davomida tashriflar</h2>
          <AreaChart data={visits} totalStudents={stats.totalStudents} />
        </div>
        <RatingWidget users={students} />
      </div>
    </div>
  );
}

function AreaChart({ data, totalStudents = 0 }) {
  const [hover, setHover] = useState(null);

  const width = 600;
  const height = 200;
  const padLeft = 30;
  const padBottom = 20;
  const padTop = 10;
  const chartW = width - padLeft;
  const chartH = height - padTop - padBottom;

  // O'lchov chapdagi o'qda jami o'quvchilar soniga (onlayn + oflayn) qadar
  // ko'rsatiladi — shu bilan grafikdagi qiymat qancha kam/ko'p ekani aniq bo'ladi.
  const max = Math.max(totalStudents, ...data, 1);
  const stepX = chartW / (data.length - 1);

  // Har bir nuqta uchun oy kunini hisoblash (oxirgi kun = bugun).
  const days = data.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (data.length - 1 - i));
    return d.getDate();
  });

  const points = data.map((v, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + chartH - (v / max) * chartH;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${padTop + chartH} L${padLeft},${padTop + chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const xLabelEvery = Math.ceil(data.length / 8);

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((relX - padLeft) / stepX)));
    setHover(idx);
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
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
          <circle
            key={i}
            cx={x}
            cy={y}
            r={hover === i ? 4 : 2.5}
            className="fill-brand-600"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {days.map(
          (d, i) =>
            (i % xLabelEvery === 0 || i === days.length - 1) && (
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
          {days[hover]}-kun: {data[hover]} ta o'quvchi onlayn
        </div>
      )}
    </div>
  );
}
