"use client";

import { useEffect, useId, useRef, useState } from "react";
import { gridFor, generateEdges, piecePath, TAB_EXTENT, formatSolveTime } from "@/lib/jigsaw";

// Ramkaning uzun tomoni SVG birliklarida. Ekrandagi haqiqiy o'lcham viewBox
// orqali moslashadi — hisob-kitoblar ekran o'lchamiga bog'liq emas.
const FRAME_BASE = 1000;
// Bo'lak to'g'ri joyiga shu masofadan (bo'lak tomoniga nisbatan) yaqin
// qo'yilsa, o'zi "yopishadi".
const SNAP_RATIO = 0.3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasmni yuklab bo'lmadi"));
    img.src = url;
  });
}

/**
 * Taxta o'lchamlari. Keng ekranda ramka markazda, bo'laklar ikki yonida;
 * tor ekranda (telefon) ramka tepada, bo'laklar pastida. Bo'sh joy bo'laklar
 * soniga qarab hisoblanadi — ular bir-birining ustiga imkon qadar kam tushsin.
 */
function buildLayout(rawAspect, target, narrow) {
  const aspect = clamp(rawAspect || 1, 0.5, 2.2);
  const FW = aspect >= 1 ? FRAME_BASE : Math.round(FRAME_BASE * aspect);
  const FH = aspect >= 1 ? Math.round(FRAME_BASE / aspect) : FRAME_BASE;
  const { rows, cols } = gridFor(target, aspect);
  const pw = FW / cols;
  const ph = FH / rows;
  const pad = TAB_EXTENT * Math.max(pw, ph);
  const count = rows * cols;
  const slotArea = (pw + pad * 0.5) * (ph + pad * 0.5);

  if (narrow) {
    const margin = pad * 1.3;
    const BW = FW + margin * 2;
    const scatterH = Math.max(FH * 0.9, (count * slotArea * 0.85) / (BW - pad * 2));
    return { rows, cols, FW, FH, pw, ph, pad, fx: margin, fy: margin, BW, BH: margin + FH + pad * 1.2 + scatterH + pad };
  }

  const my = pad * 1.5;
  const BH = FH + my * 2;
  const needed = count * slotArea * 0.75 - FW * my * 2;
  const mx = Math.max(FW * 0.35, pw + pad * 3, needed / (BH * 2));
  return { rows, cols, FW, FH, pw, ph, pad, fx: mx, fy: my, BW: FW + mx * 2, BH };
}

/**
 * Bo'laklarni ramkadan tashqariga tarqatadi. Har bir bo'lak uchun bir nechta
 * tasodifiy joy sinab ko'riladi va boshqalardan eng uzoq turgani tanlanadi
 * ("best candidate") — shunda bo'laklar uyum bo'lib qolmaydi.
 */
function scatter(indices, layout, positions, occupied = []) {
  const { BW, BH, fx, fy, FW, FH, pw, ph, pad } = layout;
  const minX = pad * 0.6;
  const maxX = BW - pw - pad * 0.6;
  const minY = pad * 0.6;
  const maxY = BH - ph - pad * 0.6;
  const centers = [...occupied];

  indices.forEach((i) => {
    let best = null;
    let bestDistance = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const overFrame =
        x + pw > fx - pad * 0.3 && x < fx + FW + pad * 0.3 && y + ph > fy - pad * 0.3 && y < fy + FH + pad * 0.3;
      if (overFrame) continue;
      const cx = x + pw / 2;
      const cy = y + ph / 2;
      let nearest = Infinity;
      for (const [ox, oy] of centers) nearest = Math.min(nearest, Math.hypot(ox - cx, oy - cy));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = { x, y };
      }
    }
    if (!best) best = { x: minX + Math.random() * (maxX - minX), y: maxY };
    positions[i] = best;
    centers.push([best.x + pw / 2, best.y + ph / 2]);
  });
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Elapsed({ since, until }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since || until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since, until]);
  if (!since) return "0:00";
  return formatSolveTime(((until || now) - since) / 1000);
}

/**
 * Fig'urali pazl taxtasi.
 *
 * Bitta SVG: har bir bo'lak — rasmning o'z konturi bilan kesilgan (clipPath)
 * nusxasi. Sudrash paytida React qayta chizmaydi — faqat sudralayotgan
 * bo'lakning `transform` atributi to'g'ridan-to'g'ri yangilanadi, shuning
 * uchun 80 bo'lakda ham silliq ishlaydi.
 */
export default function JigsawBoard({
  imageUrl,
  pieces: target,
  title,
  difficultyLabel,
  onReady,
  onComplete,
  result,
  resultError,
  onRestart,
  onExit,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const positions = useRef([]);
  const placed = useRef([]);
  const elements = useRef([]);
  const drag = useRef(null);
  const callbacks = useRef({ onReady, onComplete });
  callbacks.current = { onReady, onComplete };

  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [order, setOrder] = useState([]);
  const [placedCount, setPlacedCount] = useState(0);
  const [flash, setFlash] = useState(null);
  const [showGhost, setShowGhost] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadImage(imageUrl)
      .then((img) => {
        if (cancelled) return;
        const narrow = (wrapperRef.current?.clientWidth || 1024) < 640;
        const layout = buildLayout(img.naturalWidth / img.naturalHeight, target, narrow);
        const edges = generateEdges(layout.rows, layout.cols);
        const shapes = [];
        for (let r = 0; r < layout.rows; r++) {
          for (let c = 0; c < layout.cols; c++) {
            shapes.push({
              i: shapes.length,
              r,
              c,
              d: piecePath(r, c, layout, edges, layout.pw, layout.ph),
              homeX: layout.fx + c * layout.pw,
              homeY: layout.fy + r * layout.ph,
            });
          }
        }
        positions.current = new Array(shapes.length);
        placed.current = shapes.map(() => false);
        scatter(
          shapes.map((s) => s.i),
          layout,
          positions.current
        );
        setBoard({ layout, shapes });
        setOrder(shuffled(shapes.map((s) => s.i)));
        setStartedAt(Date.now());
        callbacks.current.onReady?.();
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, target]);

  useEffect(() => {
    setCanFullscreen(typeof document !== "undefined" && !!document.fullscreenEnabled);
    function onChange() {
      setFullscreen(document.fullscreenElement === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toBoardPoint(e) {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  }

  function handlePointerDown(e) {
    if (!board || drag.current || finishedAt) return;
    const pieceEl = e.target.closest?.("[data-piece]");
    if (!pieceEl) return;
    const i = Number(pieceEl.getAttribute("data-piece"));
    if (placed.current[i]) return;
    const point = toBoardPoint(e);
    if (!point) return;

    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    const pos = positions.current[i];
    drag.current = { i, pointerId: e.pointerId, dx: point.x - pos.x, dy: point.y - pos.y };
    pieceEl.setAttribute("filter", `url(#${uid}-lift)`);
    setOrder((prev) => (prev[prev.length - 1] === i ? prev : [...prev.filter((j) => j !== i), i]));
  }

  function handlePointerMove(e) {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const point = toBoardPoint(e);
    if (!point) return;
    const { BW, BH, pw, ph } = board.layout;
    const x = clamp(point.x - current.dx, -pw * 0.4, BW - pw * 0.6);
    const y = clamp(point.y - current.dy, -ph * 0.4, BH - ph * 0.6);
    positions.current[current.i] = { x, y };
    elements.current[current.i]?.setAttribute("transform", `translate(${x} ${y})`);
  }

  function handlePointerUp(e) {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    drag.current = null;
    const el = elements.current[current.i];
    el?.removeAttribute("filter");

    const shape = board.shapes[current.i];
    const pos = positions.current[current.i];
    const { pw, ph } = board.layout;
    if (Math.hypot(pos.x - shape.homeX, pos.y - shape.homeY) > SNAP_RATIO * Math.min(pw, ph)) return;

    positions.current[current.i] = { x: shape.homeX, y: shape.homeY };
    placed.current[current.i] = true;
    el?.setAttribute("transform", `translate(${shape.homeX} ${shape.homeY})`);
    // Joyiga tushgan bo'laklar eng pastki qatlamga o'tadi — hali yig'ilmaganlari
    // ramka ustida ham ko'rinib tursin.
    setOrder((prev) => [current.i, ...prev.filter((j) => j !== current.i)]);
    setFlash({ i: current.i, key: Date.now() });

    const count = placed.current.filter(Boolean).length;
    setPlacedCount(count);
    if (count === board.shapes.length) {
      setFinishedAt(Date.now());
      setShowGhost(false);
      callbacks.current.onComplete?.();
    }
  }

  function reshuffle() {
    if (!board || finishedAt) return;
    const loose = board.shapes.filter((s) => !placed.current[s.i]).map((s) => s.i);
    scatter(loose, board.layout, positions.current);
    loose.forEach((i) => {
      const { x, y } = positions.current[i];
      elements.current[i]?.setAttribute("transform", `translate(${x} ${y})`);
    });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapperRef.current?.requestFullscreen?.().catch(() => {});
  }

  const layout = board?.layout;
  const total = board?.shapes.length || 0;
  const finished = !!finishedAt;

  return (
    <div
      ref={wrapperRef}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        fullscreen ? "flex h-full flex-col overflow-auto rounded-none p-3" : "p-3 sm:p-4"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          Rasmlar
        </button>
        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{title}</span>
          <span className="text-slate-500">
            {" "}
            · {difficultyLabel}
            {layout && ` · ${layout.cols}×${layout.rows}`}
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          ⏱ <Elapsed since={startedAt} until={finishedAt} />
        </span>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
          {placedCount} / {total}
        </span>
        <button
          type="button"
          onClick={() => setShowGhost((v) => !v)}
          disabled={!board || finished}
          aria-pressed={showGhost}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
            showGhost
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Namuna
        </button>
        <button
          type="button"
          onClick={reshuffle}
          disabled={!board || finished}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Aralashtirish
        </button>
        {canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"}
            title={fullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={fullscreen ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"}
              />
            </svg>
          </button>
        )}
      </div>

      <div className="relative">
        {!board && !loadError && (
          <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400 dark:bg-slate-800/60">
            Pazl tayyorlanmoqda...
          </div>
        )}
        {loadError && (
          <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-rose-50 text-sm text-rose-600 dark:bg-rose-950/30">
            {loadError}
          </div>
        )}

        {board && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.BW} ${layout.BH}`}
            className="mx-auto block h-auto w-full touch-none select-none rounded-xl"
            style={{ maxHeight: fullscreen ? "calc(100vh - 80px)" : "calc(100dvh - 190px)" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            role="img"
            aria-label={`Pazl: ${title}`}
          >
            <defs>
              {board.shapes.map((s) => (
                <clipPath key={s.i} id={`${uid}-clip-${s.i}`}>
                  <path d={s.d} />
                </clipPath>
              ))}
              <filter id={`${uid}-lift`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.35" />
              </filter>
            </defs>

            <rect x="0" y="0" width={layout.BW} height={layout.BH} className="fill-slate-100 dark:fill-slate-800/70" />
            <rect
              x={layout.fx}
              y={layout.fy}
              width={layout.FW}
              height={layout.FH}
              className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
            {showGhost && (
              <image
                href={imageUrl}
                x={layout.fx}
                y={layout.fy}
                width={layout.FW}
                height={layout.FH}
                preserveAspectRatio="xMidYMid slice"
                opacity="0.25"
                pointerEvents="none"
              />
            )}

            {order.map((i) => {
              const s = board.shapes[i];
              const pos = positions.current[i];
              const isPlaced = placed.current[i];
              return (
                <g
                  key={i}
                  ref={(el) => {
                    elements.current[i] = el;
                  }}
                  data-piece={i}
                  transform={`translate(${pos.x} ${pos.y})`}
                  className={isPlaced || finished ? undefined : "cursor-grab"}
                >
                  <image
                    href={imageUrl}
                    x={-s.c * layout.pw}
                    y={-s.r * layout.ph}
                    width={layout.FW}
                    height={layout.FH}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${uid}-clip-${i})`}
                  />
                  {!finished && (
                    <path
                      d={s.d}
                      fill="none"
                      stroke={isPlaced ? "rgba(15,23,42,0.16)" : "rgba(15,23,42,0.6)"}
                      strokeWidth={isPlaced ? 1 : 2}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                  {!finished && !isPlaced && (
                    <path
                      d={s.d}
                      fill="none"
                      stroke="rgba(255,255,255,0.75)"
                      strokeWidth="0.75"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                  {flash?.i === i && (
                    <path
                      key={flash.key}
                      d={s.d}
                      fill="none"
                      stroke="#fff"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                      className="puzzle-snap"
                    />
                  )}
                </g>
              );
            })}

            {finished && (
              <image
                href={imageUrl}
                x={layout.fx}
                y={layout.fy}
                width={layout.FW}
                height={layout.FH}
                preserveAspectRatio="xMidYMid slice"
                pointerEvents="none"
                className="puzzle-reveal"
              />
            )}
          </svg>
        )}

        {finished && !overlayHidden && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
              <p className="text-4xl">🎉</p>
              <h3 className="mt-2 text-lg font-extrabold">Barakalla! Pazl yig&apos;ildi</h3>
              {!result && !resultError && <p className="mt-2 text-sm text-slate-500">Natija saqlanmoqda...</p>}
              {resultError && <p className="mt-2 text-sm font-medium text-rose-600">{resultError}</p>}
              {result && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    Vaqt: <b className="tabular-nums">{formatSolveTime(result.timeSec)}</b>
                  </p>
                  {result.solvedCount > 1 && (
                    <p className={result.isNewBest ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-500"}>
                      {result.isNewBest ? "🏆 Yangi rekord!" : `Eng yaxshi natija: ${formatSolveTime(result.bestTimeSec)}`}
                    </p>
                  )}
                  {result.pointsAwarded > 0 && (
                    <p className="font-bold text-amber-600 dark:text-amber-400">+{result.pointsAwarded} ball</p>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onRestart}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Yana yig&apos;ish
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Boshqa rasm / daraja
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayHidden(true)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Rasmni ko&apos;rish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {finished && overlayHidden && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setOverlayHidden(false)}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Natijani ko&apos;rish
          </button>
        </div>
      )}
    </div>
  );
}
