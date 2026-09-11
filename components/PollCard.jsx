"use client";

import { useState } from "react";
import { pollsApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export default function PollCard({ poll, onUpdate }) {
  const { error: toastError } = useToast();
  const [busy, setBusy] = useState(false);

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const hasVoted = poll.votedOptionIds.length > 0;
  // Bir nechta javob tanlash mumkin bo'lgan so'rovnomada ovoz berishda davom
  // etish mumkin; bittalikda — faqat bir marta.
  const canVote = poll.multiple || !hasVoted;

  async function vote(optionId) {
    if (busy || poll.votedOptionIds.includes(optionId) || !canVote) return;
    setBusy(true);
    try {
      const { poll: updated } = await pollsApi.vote(poll.id, optionId);
      onUpdate(updated);
    } catch (err) {
      toastError(err.message || "Ovoz berib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  async function unvote() {
    setBusy(true);
    try {
      const { poll: updated } = await pollsApi.unvote(poll.id);
      onUpdate(updated);
    } catch (err) {
      toastError(err.message || "Ovozni qaytarib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {poll.quiz ? "Viktorina" : "So'rovnoma"}
        </div>
        {poll.multiple && <span className="text-[11px] text-indigo-400">bir nechta javob mumkin</span>}
      </div>

      <p className="mb-4 text-sm font-medium leading-snug">{poll.question}</p>

      <div className="space-y-2">
        {poll.options.map((o) => {
          const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
          const mine = poll.votedOptionIds.includes(o.id);
          // `correct` serverdan faqat ovoz berilgandan keyin keladi — shuning
          // uchun to'g'ri javobni oldindan ko'rib bo'lmaydi.
          const isCorrect = o.correct === true;
          const isWrongPick = mine && o.correct === false;

          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={!canVote || mine || busy}
              className={`relative block w-full overflow-hidden rounded-xl border text-left transition-colors disabled:cursor-default ${
                isCorrect
                  ? "border-emerald-400"
                  : isWrongPick
                  ? "border-rose-400"
                  : mine
                  ? "border-indigo-400"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isCorrect
                      ? "bg-emerald-200/70 dark:bg-emerald-800/40"
                      : isWrongPick
                      ? "bg-rose-200/60 dark:bg-rose-900/30"
                      : mine
                      ? "bg-indigo-200/70 dark:bg-indigo-800/50"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                <span className={`flex items-center gap-1.5 ${mine ? "font-semibold text-indigo-700 dark:text-indigo-300" : ""}`}>
                  {mine && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {o.text}
                  {isCorrect && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">to&apos;g&apos;ri</span>}
                </span>
                {hasVoted && <span className="shrink-0 font-bold text-slate-600 dark:text-slate-300">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-indigo-400">{totalVotes} ovoz</p>
        {hasVoted && (
          <button onClick={unvote} disabled={busy} className="text-xs text-slate-400 hover:text-indigo-600 disabled:opacity-50">
            Ovozni qaytarib olish
          </button>
        )}
      </div>
    </div>
  );
}
