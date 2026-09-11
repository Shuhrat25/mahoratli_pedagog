"use client";

// Sahifalash — ilgari barcha ro'yxatlar (postlar, forum) to'liq yuklanardi.

function pageNumbers(page, pages) {
  const around = 1;
  const list = new Set([1, pages]);
  for (let i = page - around; i <= page + around; i++) {
    if (i >= 1 && i <= pages) list.add(i);
  }
  const sorted = [...list].sort((a, b) => a - b);
  const withGaps = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) withGaps.push("…");
    withGaps.push(n);
  });
  return withGaps;
}

export default function Pagination({ page, pages, onChange, className = "" }) {
  if (!pages || pages <= 1) return null;

  const base =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav className={`flex flex-wrap items-center justify-center gap-1 ${className}`} aria-label="Sahifalar">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        aria-label="Oldingi sahifa"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {pageNumbers(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${base} ${
              n === page
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {n}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className={`${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        aria-label="Keyingi sahifa"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
