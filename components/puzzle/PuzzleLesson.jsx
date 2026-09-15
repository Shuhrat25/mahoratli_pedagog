"use client";

import { useCallback, useEffect, useState } from "react";
import { puzzlesApi, fileUrl } from "@/lib/api";
import { DIFFICULTIES, formatSolveTime } from "@/lib/jigsaw";
import RichText from "@/components/RichText";
import JigsawBoard from "@/components/puzzle/JigsawBoard";

const DIFFICULTY_STORAGE_KEY = "puzzle:difficulty";

function readStoredDifficulty() {
  try {
    const value = window.localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    return DIFFICULTIES.some((d) => d.key === value) ? value : "EASY";
  } catch {
    return "EASY";
  }
}

/**
 * Pazl darsi: rasm tanlash → murakkablikni tanlash → yig'ish.
 *
 * Darajani talaba o'zi tanlaydi va xohlagancha qayta urinadi; har bir rasm +
 * daraja uchun eng yaxshi vaqt saqlanadi. Pazl ixtiyoriy — keyingi darsni
 * to'smaydi.
 */
export default function PuzzleLesson({ lesson, onProgress }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [difficulty, setDifficulty] = useState("EASY");
  const [game, setGame] = useState(null);
  const [result, setResult] = useState(null);
  const [resultError, setResultError] = useState("");

  useEffect(() => {
    setDifficulty(readStoredDifficulty());
  }, []);

  const load = useCallback(
    () =>
      puzzlesApi
        .lesson(lesson.id)
        .then((d) => {
          setData(d);
          setLoadError("");
          setSelectedId((prev) => (prev && d.images.some((img) => img.id === prev) ? prev : d.images[0]?.id ?? null));
        })
        .catch((err) => setLoadError(err.message || "Pazlni yuklab bo'lmadi")),
    [lesson.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  function chooseDifficulty(key) {
    setDifficulty(key);
    try {
      window.localStorage.setItem(DIFFICULTY_STORAGE_KEY, key);
    } catch {
      // saqlab bo'lmasa ham tanlov shu sahifada ishlayveradi
    }
  }

  function startGame() {
    const image = data?.images.find((img) => img.id === selectedId);
    if (!image) return;
    setResult(null);
    setResultError("");
    setGame({ image, difficulty, key: Date.now() });
  }

  function restartGame() {
    setResult(null);
    setResultError("");
    setGame((g) => ({ ...g, key: Date.now() }));
  }

  function exitGame() {
    setGame(null);
    load();
  }

  if (game) {
    const level = DIFFICULTIES.find((d) => d.key === game.difficulty);
    const index = data.images.findIndex((img) => img.id === game.image.id);
    return (
      <JigsawBoard
        key={game.key}
        imageUrl={fileUrl(game.image.fileId)}
        pieces={level.pieces}
        title={`${index + 1}-rasm`}
        difficultyLabel={level.label}
        onReady={() => {
          puzzlesApi.start(game.image.id, game.difficulty).catch((err) => setResultError(err.message));
        }}
        onComplete={() => {
          puzzlesApi
            .solve(game.image.id, game.difficulty)
            .then((r) => {
              setResult(r);
              onProgress?.();
            })
            .catch((err) => setResultError(err.message || "Natijani saqlab bo'lmadi"));
        }}
        result={result}
        resultError={resultError}
        onRestart={restartGame}
        onExit={exitGame}
      />
    );
  }

  const selected = data?.images.find((img) => img.id === selectedId);

  return (
    <div className="space-y-4">
      {lesson.content && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RichText value={lesson.content} className="leading-relaxed text-slate-700 dark:text-slate-300" />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-bold">Rasmni tanlang</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Ixtiyoriy — keyingi darsni to&apos;smaydi
          </span>
          {data?.puzzlePoints > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Har bir yangi rasm uchun +{data.puzzlePoints} ball
            </span>
          )}
        </div>

        {!data && !loadError && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
        {loadError && <p className="text-sm text-rose-600">{loadError}</p>}
        {data && data.images.length === 0 && (
          <p className="text-sm text-slate-500">O&apos;qituvchi hali pazl uchun rasm qo&apos;shmagan.</p>
        )}

        {data && data.images.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.images.map((img, idx) => {
                const solvedLevels = DIFFICULTIES.filter((d) => img.progress[d.key]?.solvedCount > 0);
                const active = img.id === selectedId;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedId(img.id)}
                    aria-pressed={active}
                    aria-label={`${idx + 1}-rasm`}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 outline-none ring-offset-2 transition dark:bg-slate-800 dark:ring-offset-slate-900 ${
                      active ? "ring-[3px] ring-indigo-500" : "ring-1 ring-slate-200 hover:ring-indigo-300 dark:ring-slate-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(img.fileId)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {idx + 1}
                    </span>
                    {solvedLevels.length > 0 && (
                      <span
                        className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow"
                        title={`Yig'ilgan: ${solvedLevels.map((d) => d.label).join(", ")}`}
                      >
                        ✓ {solvedLevels.length}/{DIFFICULTIES.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-sm font-semibold">Murakkablik darajasi</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DIFFICULTIES.map((level) => {
                  const best = selected?.progress[level.key]?.bestTimeSec;
                  const active = level.key === difficulty;
                  return (
                    <button
                      key={level.key}
                      type="button"
                      onClick={() => chooseDifficulty(level.key)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                          : "border-slate-200 hover:border-indigo-300 dark:border-slate-700"
                      }`}
                    >
                      <span className="block text-sm font-bold">{level.label}</span>
                      <span className="block text-xs text-slate-500">~{level.pieces} bo&apos;lak</span>
                      <span
                        className={`mt-1 block text-xs tabular-nums ${
                          best != null ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {best != null ? `🏆 ${formatSolveTime(best)}` : "hali yig'ilmagan"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={startGame}
                  disabled={!selected}
                  className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Yig&apos;ishni boshlash
                </button>
                <p className="text-xs text-slate-500">
                  Bo&apos;laklarni sichqoncha yoki barmoq bilan ramkaga suring — to&apos;g&apos;ri joyga yaqinlashganda o&apos;zi
                  yopishadi.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
