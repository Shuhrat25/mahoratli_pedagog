export default function WisdomCard({ quote }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <p className="text-sm italic text-slate-700 dark:text-slate-300">“{quote.quote}”</p>
      <div className="mt-1 text-xs text-slate-500">
        <span className="font-semibold text-brand-700 dark:text-brand-400">{quote.author}</span>
        {" — "}
        {quote.work}
      </div>
      {quote.note && (
        <p className="mt-1 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">
          {quote.note}
        </p>
      )}
    </div>
  );
}
