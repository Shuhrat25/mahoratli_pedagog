"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fileUrl } from "@/lib/api";

/**
 * O'qituvchi uchun pazl rasmlari maydoni: mavjud rasmlar + hali yuklanmagan
 * yangilari. Rasmlar soni cheklanmagan — tanlash, sudrab tashlash yoki bir
 * necha marta qo'shish mumkin.
 */
export default function PuzzleImagesField({ existing = [], onRemoveExisting, files, onFilesChange, progress, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(0);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  function addFiles(list) {
    const all = Array.from(list || []);
    const images = all.filter((f) => /^image\//.test(f.type));
    setRejected(all.length - images.length);
    if (images.length) onFilesChange([...files, ...images]);
  }

  function removePending(index) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  const total = existing.length + files.length;

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
            : "border-slate-300 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-semibold">Rasmlarni tanlang yoki shu yerga tashlang</span>
        <span className="text-xs text-slate-500">
          Istalgancha rasm qo&apos;shish mumkin — talaba ulardan birini tanlab yig&apos;adi. Katta rasmlar avtomatik
          kichraytiriladi.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {rejected > 0 && (
        <p className="mt-1 text-xs text-amber-600">{rejected} ta fayl rasm emasligi uchun qo&apos;shilmadi.</p>
      )}

      {total > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Jami: <b>{total}</b> ta rasm
            {files.length > 0 && existing.length > 0 && ` (${files.length} tasi yangi)`}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {existing.map((img) => (
              <Thumb key={img.id} src={fileUrl(img.fileId)} title={img.name} onRemove={() => onRemoveExisting?.(img)} disabled={disabled} />
            ))}
            {previews.map((p, i) => (
              <Thumb key={p.url} src={p.url} title={p.file.name} badge="yangi" onRemove={() => removePending(i)} disabled={disabled} />
            ))}
          </div>
        </div>
      )}

      {progress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Rasmlar yuklanmoqda...</span>
            <span className="tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({ src, title, badge, onRemove, disabled }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700" title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      {badge && (
        <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Rasmni olib tashlash"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-rose-600 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
