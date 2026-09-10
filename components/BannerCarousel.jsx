"use client";

import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/api";
import RichText from "@/components/RichText";

export default function BannerCarousel({ banners }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners || banners.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(id);
  }, [banners]);

  if (!banners || banners.length === 0) return null;
  const banner = banners[index];
  const hasImage = !!banner.imageId;

  function go(delta) {
    setIndex((i) => (i + delta + banners.length) % banners.length);
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl bg-cover bg-center p-7 text-white shadow-lg shadow-indigo-900/10 sm:p-10 ${
        hasImage ? "" : `bg-gradient-to-br ${banner.color}`
      }`}
      style={{ minHeight: "180px", backgroundImage: hasImage ? `url(${fileUrl(banner.imageId)})` : undefined }}
    >
      {hasImage ? (
        // Rasm ustidagi matn har doim o'qilishi uchun qorong'i pardalar
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      ) : (
        <>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
        </>
      )}

      <div className="relative max-w-xl">
        <h2 className="text-xl font-extrabold leading-tight drop-shadow-sm sm:text-3xl">{banner.title}</h2>
        <RichText value={banner.text} inline className="mt-3 text-sm text-white/90 drop-shadow-sm sm:text-base" />
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Oldingi"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition hover:bg-white/25 group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Keyingi"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition hover:bg-white/25 group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="relative mt-6 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                aria-label={`Banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
