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

  const max = Math.max(...VISITS);

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
          <div className="flex h-40 items-end gap-1">
            {VISITS.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-brand-500/80 dark:bg-brand-500/60"
                style={{ height: `${(v / max) * 100}%` }}
                title={`${v} tashrif`}
              />
            ))}
          </div>
        </div>
        <RatingWidget users={students} />
      </div>
    </div>
  );
}
