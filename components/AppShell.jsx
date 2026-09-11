"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/auth-context";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { Icon, paths } from "./icons";

export default function AppShell({ navItems, roleLabel, children }) {
  const pathname = usePathname();
  const { currentUser, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  // logout() o'zi mehmon bosh sahifasiga to'liq qayta yuklash bilan o'tadi —
  // bu yerda qo'shimcha router.push kerak emas (ular poygaga tushardi).
  async function handleLogout() {
    await logout();
  }

  const basePath = currentUser?.role === "STUDENT" ? "/student" : "/teacher";
  const profileHref = currentUser?.role === "STUDENT" ? "/student/profile" : "/teacher";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Menyu" className="text-slate-600 dark:text-slate-300">
          <Icon path={paths.menu} className="h-6 w-6" />
        </button>
        <span className="font-semibold text-brand-700 dark:text-brand-400">Mahoratli pedagog</span>
        <div className="flex items-center gap-1">
          <NotificationBell basePath={basePath} />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
          <SidebarContent
            navItems={navItems}
            pathname={pathname}
            roleLabel={roleLabel}
            currentUser={currentUser}
            profileHref={profileHref}
            onLogout={handleLogout}
          />
        </aside>

        {/* Sidebar mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white dark:bg-slate-900">
              <div className="flex justify-end p-2">
                <button onClick={() => setMobileOpen(false)} className="p-2 text-slate-500" aria-label="Yopish">
                  <Icon path={paths.close} />
                </button>
              </div>
              <SidebarContent
                navItems={navItems}
                pathname={pathname}
                roleLabel={roleLabel}
                currentUser={currentUser}
                profileHref={profileHref}
                onLogout={handleLogout}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
            <NotificationBell basePath={basePath} />
            <ThemeToggle />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ navItems, pathname, roleLabel, currentUser, profileHref, onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
        <Link href="/" className="text-lg font-bold text-brand-700 dark:text-brand-400">
          Mahoratli pedagog
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
      </div>

      <Link
        href={profileHref}
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {currentUser?.firstName?.charAt(0) || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Foydalanuvchi"}
          </p>
          <p className="truncate text-xs text-slate-500">{currentUser?.email}</p>
        </div>
      </Link>

      <nav className="scrollbar-soft flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon path={item.icon} className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onLogout}
        className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        <Icon path={paths.logout} className="h-5 w-5" />
        Chiqish
      </button>
    </div>
  );
}
