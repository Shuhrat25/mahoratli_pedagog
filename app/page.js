"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";
import { bannersApi } from "@/lib/api";
import { WISDOM_QUOTES } from "@/lib/mockData";
import ThemeToggle from "@/components/ThemeToggle";
import BannerCarousel from "@/components/BannerCarousel";
import WisdomCard from "@/components/WisdomCard";
import { Icon, paths } from "@/components/icons";

export default function GuestHomePage() {
  const { currentUser, ready } = useApp();
  const router = useRouter();
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    bannersApi.list().then(({ banners }) => setBanners(banners)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !currentUser) return;
    if (currentUser.role === "STUDENT") router.replace("/student");
    else router.replace("/teacher");
  }, [ready, currentUser, router]);

  if (!ready || currentUser) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Yuklanmoqda...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-bold text-brand-700 dark:text-brand-400">Mahoratli pedagog</span>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="hidden text-sm font-medium text-slate-600 hover:text-brand-700 dark:text-slate-300 sm:inline">
              Bosh sahifa
            </Link>
            <ThemeToggle />
            <Link href="/login" className="btn-primary">
              Kirish
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        <BannerCarousel banners={banners} />

        <section className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={paths.lessons}
            title="Vazifalar va testlar"
            text="Video-darslar, matnli materiallar va avtomatik tekshiriladigan testlar."
          />
          <FeatureCard
            icon={paths.assignments}
            title="Ajdodlarimiz komiksda"
            text="Milliy ertaklar asosida komiks yaratish orqali ijodiy va axloqiy fikrlashni rivojlantirish."
          />
          <FeatureCard
            icon={paths.forum}
            title="Forum va hamjamiyat"
            text="Talabalar va o'qituvchilar bir-biri bilan fikr almashadi, savol-javob qiladi."
          />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ajdodlar o'giti va milliy hikmatlar</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WISDOM_QUOTES.slice(0, 3).map((q) => (
              <WisdomCard key={q.id} quote={q} />
            ))}
          </div>
        </section>

        <section className="card flex flex-col items-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">Boʻlajak pedagog sifatida mahoratingizni oshiring</h2>
          <p className="max-w-xl text-sm text-slate-500">
            Ro'yxatdan o'ting va darslar, vazifalar, materiallar hamda forumga to'liq kirish huquqiga ega bo'ling.
          </p>
          <div className="flex gap-3">
            <Link href="/register" className="btn-primary">
              Ro'yxatdan o'tish
            </Link>
            <Link href="/login" className="btn-secondary">
              Kirish
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
        © 2026 Mahoratli pedagog
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
        <Icon path={icon} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
