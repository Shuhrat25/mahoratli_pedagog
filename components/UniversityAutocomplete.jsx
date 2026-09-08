"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UNIVERSITIES } from "@/lib/universities";

// Apostrof/tutuq belgilarini (', ‘, ’, ʻ, ʼ, `) butunlay olib tashlaydi —
// aks holda "Farg'ona"/"Farg‘ona" kabi yozilishlar bir-biriga, va odatiy
// klaviaturada shu belgisiz yozilgan "fargona" kabi qidiruvlar ularga mos
// kelmay qolardi.
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[‘’ʻʼʽ`']/g, "");
}

export default function UniversityAutocomplete({ value, onChange, placeholder, className = "input" }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ham to'liq nom bo'yicha (har qanday qismidan), ham abreviatura bo'yicha
  // qidiradi — masalan "texnika" yoki "TDTU" ikkalasi ham mos natija beradi.
  const results = useMemo(() => {
    const q = normalize(value).trim();
    if (!q) return [];
    const qUpper = value.trim().toUpperCase();
    return UNIVERSITIES.filter((u) => normalize(u.name).includes(q) || (u.abbr && u.abbr.includes(qUpper))).slice(0, 8);
  }, [value]);

  function select(name) {
    onChange(name);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[highlight].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {results.map((u, i) => (
            <li
              key={u.name}
              onMouseDown={(e) => {
                e.preventDefault();
                select(u.name);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {u.name}
              {u.abbr && <span className="ml-1.5 text-xs text-slate-400">({u.abbr})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
