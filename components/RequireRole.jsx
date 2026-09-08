"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";

export default function RequireRole({ roles, children }) {
  const { currentUser, ready } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!currentUser || !roles.includes(currentUser.role)) {
      router.replace("/login");
    }
  }, [ready, currentUser, roles, router]);

  if (!ready || !currentUser || !roles.includes(currentUser.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }

  return children;
}
