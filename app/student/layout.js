"use client";

import RequireRole from "@/components/RequireRole";
import AppShell from "@/components/AppShell";
import { paths } from "@/components/icons";

const navItems = [
  { href: "/student", label: "Bosh sahifa", icon: paths.home },
  { href: "/student/lessons", label: "Darslar", icon: paths.lessons },
  { href: "/student/assignments", label: "Vazifalar", icon: paths.assignments },
  { href: "/student/materials", label: "Materiallar", icon: paths.materials },
  { href: "/student/forum", label: "Forum", icon: paths.forum },
];

export default function StudentLayout({ children }) {
  return (
    <RequireRole roles={["STUDENT"]}>
      <AppShell navItems={navItems} roleLabel="Talaba kabineti">
        {children}
      </AppShell>
    </RequireRole>
  );
}
