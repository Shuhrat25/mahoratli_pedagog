"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";
import { topicsApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

// Kursni tugatgan talaba uchun sertifikat.
//
// Ataylab PDF kutubxonasisiz: sahifa chop etishga (Ctrl+P / "Saqlash → PDF")
// moslab tayyorlangan — brauzerning o'zi PDF yaratadi, hech qanday qo'shimcha
// paket kerak emas.

export default function CertificatePage() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [state, setState] = useState(null);

  useEffect(() => {
    topicsApi
      .list()
      .then(({ topics }) => {
        const lessons = topics.flatMap((t) => t.lessons);
        const done = lessons.filter((l) => l.done);
        const scores = done.map((l) => l.score).filter((s) => s != null);
        setState({
          total: lessons.length,
          done: done.length,
          topics: topics.length,
          averageScore: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
          completedAt: new Date(),
        });
      })
      .catch(() => setState({ total: 0, done: 0, topics: 0, averageScore: null }));
  }, []);

  if (!state || !currentUser) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const finished = state.total > 0 && state.done === state.total;

  if (!finished) {
    const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Icon path={paths.certificate} className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold">Sertifikat hali tayyor emas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sertifikat kursning barcha darslari tugatilgandan keyin ochiladi.
          </p>
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm font-medium">
              {state.done} / {state.total} dars ({pct}%)
            </p>
          </div>
          <button onClick={() => router.push("/student/lessons")} className="btn-primary mt-6">
            Darslarga o&apos;tish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-semibold">Sertifikat</h1>
        <button onClick={() => window.print()} className="btn-primary">
          <Icon path={paths.download} className="h-4 w-4" /> Chop etish / PDF saqlash
        </button>
      </div>

      <div className="certificate mx-auto max-w-3xl rounded-2xl border-[6px] border-double border-brand-600 bg-white p-8 text-center shadow-lg sm:p-12">
        <p className="text-xs uppercase tracking-[0.3em] text-brand-600">Mahoratli pedagog</p>
        <h2 className="mt-6 text-3xl font-extrabold text-slate-900 sm:text-4xl">SERTIFIKAT</h2>
        <p className="mt-2 text-sm text-slate-500">kursni muvaffaqiyatli tamomlaganligi uchun</p>

        <p className="mt-8 text-2xl font-bold text-slate-900 sm:text-3xl">
          {currentUser.firstName} {currentUser.lastName}
        </p>
        {currentUser.university && <p className="mt-1 text-sm text-slate-500">{currentUser.university}</p>}

        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
          &ldquo;Mahoratli pedagog&rdquo; platformasidagi boshlang&apos;ich sinf o&apos;qituvchilari uchun mo&apos;ljallangan
          kursning barcha {state.topics} ta mavzusi va {state.total} ta darsini to&apos;liq o&apos;zlashtirdi.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-sm">
          <div>
            <p className="text-2xl font-bold text-brand-700">{state.done}</p>
            <p className="text-xs text-slate-500">dars</p>
          </div>
          {state.averageScore != null && (
            <div>
              <p className="text-2xl font-bold text-brand-700">{state.averageScore}%</p>
              <p className="text-xs text-slate-500">o&apos;rtacha test natijasi</p>
            </div>
          )}
          <div>
            <p className="text-2xl font-bold text-brand-700">{currentUser.points}</p>
            <p className="text-xs text-slate-500">ball</p>
          </div>
        </div>

        <div className="mt-10 flex items-end justify-between gap-6 text-xs text-slate-500">
          <div className="text-left">
            <p className="border-t border-slate-300 pt-1">Sana</p>
            <p className="font-medium text-slate-700">{state.completedAt.toLocaleDateString("uz-UZ")}</p>
          </div>
          <div className="text-right">
            <p className="border-t border-slate-300 pt-1">Sertifikat raqami</p>
            <p className="font-mono font-medium text-slate-700">MP-{currentUser.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Chop etishda faqat sertifikat qoladi */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          aside,
          nav,
          header,
          .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          .certificate {
            box-shadow: none;
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
