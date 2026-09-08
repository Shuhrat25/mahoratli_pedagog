"use client";

import { pollsApi } from "@/lib/api";

export default function PollCard({ poll, onUpdate }) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const hasVoted = poll.votedOptionIds.length > 0;

  async function vote(optionId) {
    if (hasVoted) return;
    const { poll: updated } = await pollsApi.vote(poll.id, optionId);
    onUpdate(updated);
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-900">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        So'rovnoma
      </div>
      <p className="mb-4 text-sm font-medium leading-snug">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((o) => {
          const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
          const mine = poll.votedOptionIds.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={hasVoted}
              className={`relative block w-full overflow-hidden rounded-xl border text-left transition-colors disabled:cursor-default ${
                mine ? "border-indigo-400" : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    mine ? "bg-indigo-200/70 dark:bg-indigo-800/50" : "bg-slate-100 dark:bg-slate-800"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between px-3.5 py-2.5 text-sm">
                <span className={`flex items-center gap-1.5 ${mine ? "font-semibold text-indigo-700 dark:text-indigo-300" : ""}`}>
                  {mine && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {o.text}
                </span>
                {hasVoted && <span className="font-bold text-slate-600 dark:text-slate-300">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-medium text-indigo-400">{totalVotes} ovoz</p>
    </div>
  );
}
