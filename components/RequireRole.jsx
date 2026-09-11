"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";

export default function RequireRole({ roles, children }) {
  const { currentUser, ready } = useApp();
  const router = useRouter();
  // `roles` har renderда yangi massiv bo'lib kelardi va effekt har safar qayta
  // ishga tushardi — kalitga aylantirib, faqat haqiqiy o'zgarishga bog'laymiz.
  const rolesKey = roles.join(",");

  const allowed = !!currentUser && roles.includes(currentUser.role);

  useEffect(() => {
    if (!ready) return;
    if (allowed) return;
    // Chiqish (logout) paytida auth-context o'zi bosh sahifaga to'liq qayta
    // yuklash bilan o'tadi — bu yerda /login'ga yo'naltirib, u bilan poyga
    // qilmaymiz.
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    // Tizimga kirgan, lekin roli mos kelmasa — o'z kabinetiga qaytaramiz.
    router.replace(currentUser.role === "STUDENT" ? "/student" : "/teacher");
  }, [ready, allowed, currentUser, rolesKey, router]);

  if (!ready || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }

  return children;
}
