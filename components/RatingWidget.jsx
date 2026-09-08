export function PointsBadge({ points }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2l2.9 6.26 6.9.6-5.2 4.6 1.6 6.78L12 16.9l-6.2 3.34 1.6-6.78-5.2-4.6 6.9-.6z" />
      </svg>
      {points}
    </span>
  );
}

export default function RatingWidget({ users }) {
  const sorted = [...users].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);
  const medalStyle = [
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 flex items-center gap-2 font-bold">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-amber-500">
          <path d="M12 2l2.9 6.26 6.9.6-5.2 4.6 1.6 6.78L12 16.9l-6.2 3.34 1.6-6.78-5.2-4.6 6.9-.6z" />
        </svg>
        Reyting
      </h3>
      <ol className="space-y-3">
        {sorted.map((u, i) => (
          <li key={u.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  medalStyle[i] || "bg-slate-100 text-slate-500 dark:bg-slate-800"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {u.firstName} {u.lastName}
              </span>
            </div>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{u.points || 0}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
