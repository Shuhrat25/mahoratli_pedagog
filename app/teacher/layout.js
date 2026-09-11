"use client";

import RequireRole from "@/components/RequireRole";
import AppShell from "@/components/AppShell";
import { paths } from "@/components/icons";

const navItems = [
  { href: "/teacher", label: "Bosh sahifa", icon: paths.dashboard },
  { href: "/teacher/participants", label: "Ishtirokchilar", icon: paths.participants },
  { href: "/teacher/progress", label: "Taraqqiyot", icon: paths.chart },
  { href: "/teacher/home-settings", label: "Bosh sahifa sozlamalari", icon: paths.settings },
  { href: "/teacher/lessons", label: "Darslar", icon: paths.lessons },
  { href: "/teacher/assignments", label: "Vazifalar", icon: paths.assignments },
  { href: "/teacher/materials", label: "Materiallar", icon: paths.materials },
  { href: "/teacher/forum", label: "Forum", icon: paths.forum },
];

export default function TeacherLayout({ children }) {
  return (
    <RequireRole roles={["TEACHER", "ADMIN"]}>
      <AppShell navItems={navItems} roleLabel="O'qituvchi kabineti">
        {children}
      </AppShell>
    </RequireRole>
  );
}
