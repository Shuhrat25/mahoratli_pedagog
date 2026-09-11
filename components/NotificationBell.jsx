"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";

function timeAgo(date) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "hozirgina";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} kun oldin`;
  return new Date(date).toLocaleDateString("uz-UZ");
}

const TYPE_ICON = {
  ASSIGNMENT_NEW: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 13h6M9 17h6",
  ASSIGNMENT_GRADED: "M20 6L9 17l-5-5",
  ASSIGNMENT_DUE_SOON: "M12 8v4l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  FORUM_REPLY: "M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1121 11.5z",
  POST_NEW: "M4 19.5A2.5 2.5 0 016.5 17H20V4H6.5A2.5 2.5 0 004 6.5v13z",
  LESSON_LIVE: "M15 10l4.5-2.5v9L15 14M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z",
  SUBMISSION_NEW: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16",
};

export default function NotificationBell({ basePath }) {
  const { notifications, unread, markNotificationsRead, clearNotifications, loadNotifications } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  }

  // Havola "/" bilan boshlansa — mutlaq manzil; aks holda foydalanuvchi
  // kabinetiga nisbatan (forum kabi ikkala rol uchun umumiy sahifalar).
  function hrefOf(notification) {
    if (!notification.link) return null;
    return notification.link.startsWith("/") ? notification.link : `${basePath}/${notification.link}`;
  }

  function openNotification(notification) {
    if (!notification.read) markNotificationsRead([notification.id]);
    const href = hrefOf(notification);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Bildirishnomalar (${unread} ta yangi)` : "Bildirishnomalar"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-sm font-semibold">Bildirishnomalar</span>
            <div className="flex items-center gap-2 text-xs">
              {unread > 0 && (
                <button onClick={() => markNotificationsRead()} className="text-brand-700 hover:underline dark:text-brand-400">
                  O&apos;qilgan deb belgilash
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearNotifications} className="text-slate-400 hover:text-rose-600">
                  Tozalash
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Hozircha bildirishnoma yo&apos;q</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/50 ${
                  n.read ? "" : "bg-brand-50/50 dark:bg-brand-900/10"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    n.read
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
                      : "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d={TYPE_ICON[n.type] || TYPE_ICON.POST_NEW} />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
