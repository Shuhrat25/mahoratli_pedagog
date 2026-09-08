"use client";

import { useEffect, useState } from "react";
import { usersApi, assignmentsApi } from "@/lib/api";
import StatCard from "@/components/StatCard";
import RatingWidget from "@/components/RatingWidget";
import { Icon, paths } from "@/components/icons";

// Demo uchun statik hafta bo'yicha tashrif grafiği (real analitika keyingi bosqichda)
const VISITS = [12, 18, 9, 22, 30, 25, 40, 33, 28, 45, 38, 50, 42, 55, 47, 60, 52, 65, 58, 70, 63, 75, 68, 80, 72, 85, 77, 90, 82, 95];

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState({ totalStudents: 0, online: 0 });
  const [students, setStudents] = useState([]);
  const [openAssignments, setOpenAssignments] = useState(0);
  const [loading, setLoading] = useState(true);

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
          <AreaChart data={VISITS} />
        </div>
        <RatingWidget users={students} />
      </div>
    </div>
  );
}

function AreaChart({ data }) {
  const width = 600;
  const height = 160;
  const max = Math.max(...data);
  const min = 0;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / (max - min)) * height;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" className="text-brand-500" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" className="text-brand-500" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#visitsFill)" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-500" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" className="fill-brand-600" vectorEffect="non-scaling-stroke">
          <title>{data[i]} tashrif</title>
        </circle>
      ))}
    </svg>
  );
}
