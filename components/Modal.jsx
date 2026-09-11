"use client";

import { useEffect } from "react";

/**
 * Modal oyna.
 *
 * Sarlavha qatori qimirlamaydi, faqat mazmun aylanadi — ilgari butun oyna
 * aylanardi va tizimning qo'pol scrollbar'i yumaloqlangan burchak ustiga
 * chiqib turardi. Scrollbar ko'rinishi app/globals.css da belgilangan.
 */
export default function Modal({ open, onClose, title, children, wide }) {
  // Oyna ochiq turganda orqa fon aylanmasin.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  // Fonga bosish yoki Escape bilan yopish ATAYLAB qo'shilmagan: bu oynalarda
  // uzun forma bo'ladi (post matni, dars mazmuni) va tasodifiy bosish yozilgan
  // hamma narsani yo'q qilib yuborardi. Yopish — faqat ✕ tugmasi orqali.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`flex max-h-[90vh] w-full ${
          wide ? "max-w-2xl" : "max-w-md"
        } flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Yopish"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
