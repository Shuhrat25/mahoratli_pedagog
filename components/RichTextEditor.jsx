"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isEmptyHtml, sanitizeHtml, toEditorHtml } from "@/lib/richText";

/**
 * Tashqi kutubxonasiz (zero-dependency) rich-text tahrirlagich —
 * o'qituvchi/admin kabinetidagi barcha matn maydonlari uchun.
 *
 * Muhim jihatlar:
 *  - contentEditable React tomonidan "boshqarilmaydi": innerHTML faqat tashqi
 *    qiymat haqiqatan o'zgarganda yoziladi, aks holda har bosishda kursor
 *    matn boshiga sakrab ketardi.
 *  - Nusxa-ko'chirilgan HTML (Word, sayt...) qo'yilishidan oldin tozalanadi.
 *  - Chiqadigan qiymat ham tozalanadi — server tomonda yana bir bor
 *    tekshiriladi (server/src/lib/sanitizeHtml.js).
 */

const FULL_COLORS = [
  "#0f172a", "#475569", "#94a3b8", "#dc2626", "#ea580c", "#ca8a04",
  "#16a34a", "#0d9488", "#2563eb", "#4f46e5", "#9333ea", "#db2777",
];

const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff", "#fed7aa"];

const BLOCKS = [
  { value: "p", label: "Oddiy matn" },
  { value: "h1", label: "Sarlavha 1" },
  { value: "h2", label: "Sarlavha 2" },
  { value: "h3", label: "Sarlavha 3" },
  { value: "blockquote", label: "Iqtibos" },
  { value: "pre", label: "Kod bloki" },
];

// Bu buyruqlar CSS uslublari bilan yaxshiroq ishlaydi (rang, tekislash);
// qolganlari <b>/<i>/<u> teglarini chiqaradi — bu tozalash uchun qulayroq.
const CSS_COMMANDS = new Set(["foreColor", "hiliteColor", "justifyLeft", "justifyCenter", "justifyRight"]);

function Glyph({ d, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {d}
    </svg>
  );
}

const G = {
  bold: (
    <>
      <path d="M6 4h7a4 4 0 010 8H6z" />
      <path d="M6 12h8a4 4 0 010 8H6z" />
    </>
  ),
  italic: <path d="M19 4h-9M14 20H5M15 4L9 20" />,
  underline: <path d="M6 4v6a6 6 0 0012 0V4M4 20h16" />,
  strike: (
    <path d="M4 12h16M17 7a4 4 0 00-4-3h-1.5A3.5 3.5 0 008 7.5c0 1.5 1 2.6 2.5 3.2M7 17a4 4 0 004 3h1.6a3.4 3.4 0 003.4-3.4c0-1-.4-1.9-1.2-2.6" />
  ),
  ul: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  ol: <path d="M10 6h10M10 12h10M10 18h10M4 6h2M5 6v4M4 10h2M4 14h2.5L4 18h2.5" />,
  quote: <path d="M7 7h4v5a4 4 0 01-4 4M15 7h4v5a4 4 0 01-4 4" />,
  code: <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />,
  link: (
    <>
      <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1" />
    </>
  ),
  unlink: (
    <>
      <path d="M10 13a5 5 0 007.5.5M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7" />
      <path d="M3 3l18 18" />
    </>
  ),
  alignLeft: <path d="M4 6h16M4 12h10M4 18h14" />,
  alignCenter: <path d="M4 6h16M7 12h10M5 18h14" />,
  alignRight: <path d="M4 6h16M10 12h10M6 18h14" />,
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 106-6.7L3 13" />
    </>
  ),
  redo: (
    <>
      <path d="M21 7v6h-6" />
      <path d="M20.5 13a9 9 0 11-6-6.7L21 13" />
    </>
  ),
  clear: <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  color: <path d="M5 20h14M7 16l5-12 5 12M9 12h6" />,
  marker: (
    <>
      <path d="M12 3l7 7-8 8H6l-2-2 8-10z" />
      <path d="M4 21h16" />
    </>
  ),
  rule: <path d="M4 12h16M7 7h10M7 17h10" />,
  expand: <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />,
  collapse: <path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" />,
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Matn yozing...",
  compact = false,
  disabled = false,
  minHeight,
  ariaLabel,
}) {
  const editorRef = useRef(null);
  const lastValueRef = useRef(null);
  const savedRangeRef = useRef(null);
  const rootRef = useRef(null);

  const [active, setActive] = useState({});
  const [blockTag, setBlockTag] = useState("p");
  const [palette, setPalette] = useState(null); // "text" | "mark" | null
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });

  const height = minHeight ?? (compact ? 110 : 200);

  const updateCounts = useCallback(() => {
    const text = editorRef.current?.innerText || "";
    const trimmed = text.replace(/\s+/g, " ").trim();
    setCounts({ words: trimmed ? trimmed.split(" ").length : 0, chars: text.replace(/\n/g, "").length });
  }, []);

  // Tashqi qiymat o'zgarganda (modal ochilishi, "tahrirlash" tugmasi) DOM
  // yangilanadi. Foydalanuvchi yozayotganda bu shart bajarilmaydi, shuning
  // uchun kursor joyida qoladi.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = value ?? "";
    if (incoming === lastValueRef.current) return;
    lastValueRef.current = incoming;
    el.innerHTML = toEditorHtml(incoming);
    updateCounts();
  }, [value, updateCounts]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    const next = isEmptyHtml(clean) ? "" : clean;
    lastValueRef.current = next;
    updateCounts();
    onChange?.(next);
  }, [onChange, updateCounts]);

  const saveRange = useCallback(() => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) return;
    if (!editorRef.current?.contains(sel.anchorNode)) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreRange = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const refreshState = useCallback(() => {
    if (typeof document === "undefined") return;
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
    try {
      // Enter <div> emas, <p> yaratsin — chiqadigan HTML toza bo'ladi.
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* eski brauzerlar — e'tiborsiz */
    }
    const state = {};
    [
      "bold",
      "italic",
      "underline",
      "strikeThrough",
      "insertUnorderedList",
      "insertOrderedList",
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
    ].forEach((cmd) => {
      try {
        state[cmd] = document.queryCommandState(cmd);
      } catch {
        state[cmd] = false;
      }
    });
    setActive(state);
    try {
      const block = (document.queryCommandValue("formatBlock") || "p").toLowerCase();
      setBlockTag(BLOCKS.some((b) => b.value === block) ? block : "p");
    } catch {
      setBlockTag("p");
    }
  }, []);

  useEffect(() => {
    function onSelectionChange() {
      saveRange();
      refreshState();
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [saveRange, refreshState]);

  // Palitra / havola oynachasini tashqariga bosilganda yopish
  useEffect(() => {
    if (!palette && !linkOpen) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPalette(null);
        setLinkOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [palette, linkOpen]);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const exec = useCallback(
    (command, commandValue) => {
      if (disabled) return;
      const el = editorRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        el.focus();
        restoreRange();
      }
      try {
        document.execCommand("styleWithCSS", false, CSS_COMMANDS.has(command));
        document.execCommand(command, false, commandValue);
      } catch {
        /* brauzer buyruqni qo'llab-quvvatlamasa — jim o'tkazamiz */
      }
      emit();
      refreshState();
    },
    [disabled, emit, refreshState, restoreRange]
  );

  function handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData?.getData("text/html");
    const text = e.clipboardData?.getData("text/plain") || "";
    const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const payload = html
      ? sanitizeHtml(html)
      : text
          .split(/\n{2,}/)
          .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
          .join("");
    document.execCommand("insertHTML", false, payload);
    emit();
  }

  function handleKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openLink();
    }
  }

  function openLink() {
    saveRange();
    const sel = window.getSelection();
    const anchor = sel?.anchorNode?.parentElement?.closest?.("a");
    setLinkValue(anchor?.getAttribute("href") || "https://");
    setPalette(null);
    setLinkOpen(true);
  }

  function applyLink() {
    const url = linkValue.trim();
    setLinkOpen(false);
    if (!url || url === "https://") return;
    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : `https://${url}`;
    editorRef.current?.focus();
    restoreRange();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      const href = safe.replace(/"/g, "&quot;");
      const label = safe.replace(/</g, "&lt;");
      document.execCommand("insertHTML", false, `<a href="${href}">${label}</a>`);
      emit();
    } else {
      exec("createLink", safe);
    }
  }

  const btnClass = (isActive) =>
    `flex h-8 min-w-[2rem] items-center justify-center gap-1 rounded-lg px-1.5 text-[13px] font-medium transition-all active:scale-95 disabled:opacity-40 ${
      isActive
        ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30"
        : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white"
    }`;

  const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;

  function ToolButton({ icon, title, onClick, isActive }) {
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={!!isActive}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={btnClass(isActive)}
      >
        <Glyph d={icon} />
      </button>
    );
  }

  // Ildiz elementda `overflow-hidden` ATAYLAB yo'q: rang palitrasi va havola
  // oynachasi asboblar panelidan tashqariga chiqadi — aks holda qirqilib qolardi.
  return (
    <div
      ref={rootRef}
      className={
        fullscreen
          ? "fixed inset-3 z-[70] flex flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:inset-8"
          : "relative flex flex-col rounded-xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-900"
      }
    >
      {/* Asboblar paneli */}
      <div className="relative z-20 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-2 py-1.5 dark:border-slate-800 dark:from-slate-800/70 dark:to-slate-900">
        <ToolButton icon={G.undo} title="Bekor qilish (Ctrl+Z)" onClick={() => exec("undo")} />
        <ToolButton icon={G.redo} title="Qaytarish (Ctrl+Y)" onClick={() => exec("redo")} />
        <Divider />

        {!compact && (
          <>
            <select
              value={blockTag}
              disabled={disabled}
              onMouseDown={saveRange}
              onChange={(e) => exec("formatBlock", `<${e.target.value}>`)}
              className="h-8 rounded-lg border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-slate-600 outline-none hover:bg-slate-200/70 focus:border-brand-500 dark:text-slate-300 dark:hover:bg-slate-700/60"
              aria-label="Matn uslubi"
            >
              {BLOCKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <Divider />
          </>
        )}

        <ToolButton icon={G.bold} title="Qalin (Ctrl+B)" isActive={active.bold} onClick={() => exec("bold")} />
        <ToolButton icon={G.italic} title="Kursiv (Ctrl+I)" isActive={active.italic} onClick={() => exec("italic")} />
        <ToolButton icon={G.underline} title="Tagi chizilgan (Ctrl+U)" isActive={active.underline} onClick={() => exec("underline")} />
        <ToolButton icon={G.strike} title="Ustidan chizilgan" isActive={active.strikeThrough} onClick={() => exec("strikeThrough")} />

        <Divider />
        <div className="relative">
          <ToolButton
            icon={G.color}
            title="Matn rangi"
            isActive={palette === "text"}
            onClick={() => {
              saveRange();
              setLinkOpen(false);
              setPalette((p) => (p === "text" ? null : "text"));
            }}
          />
          {palette === "text" && (
            <Palette
              colors={FULL_COLORS}
              onPick={(c) => {
                setPalette(null);
                exec("foreColor", c);
              }}
              onReset={() => {
                setPalette(null);
                exec("removeFormat");
              }}
            />
          )}
        </div>
        <div className="relative">
          <ToolButton
            icon={G.marker}
            title="Fon rangi (marker)"
            isActive={palette === "mark"}
            onClick={() => {
              saveRange();
              setLinkOpen(false);
              setPalette((p) => (p === "mark" ? null : "mark"));
            }}
          />
          {palette === "mark" && (
            <Palette
              colors={HIGHLIGHTS}
              onPick={(c) => {
                setPalette(null);
                exec("hiliteColor", c);
              }}
              onReset={() => {
                setPalette(null);
                exec("hiliteColor", "transparent");
              }}
            />
          )}
        </div>

        <Divider />
        <ToolButton icon={G.ul} title="Belgili ro'yxat" isActive={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")} />
        <ToolButton icon={G.ol} title="Raqamli ro'yxat" isActive={active.insertOrderedList} onClick={() => exec("insertOrderedList")} />

        {!compact && (
          <>
            <ToolButton icon={G.quote} title="Iqtibos" onClick={() => exec("formatBlock", "<blockquote>")} />
            <ToolButton icon={G.code} title="Kod bloki" onClick={() => exec("formatBlock", "<pre>")} />
            <Divider />
            <ToolButton
              icon={G.alignLeft}
              title="Chapga tekislash"
              isActive={active.justifyLeft && !active.justifyCenter && !active.justifyRight}
              onClick={() => exec("justifyLeft")}
            />
            <ToolButton icon={G.alignCenter} title="Markazga tekislash" isActive={active.justifyCenter} onClick={() => exec("justifyCenter")} />
            <ToolButton icon={G.alignRight} title="O'ngga tekislash" isActive={active.justifyRight} onClick={() => exec("justifyRight")} />
            <ToolButton icon={G.rule} title="Ajratuvchi chiziq" onClick={() => exec("insertHorizontalRule")} />
          </>
        )}

        <Divider />
        <div className="relative">
          <ToolButton icon={G.link} title="Havola (Ctrl+K)" isActive={linkOpen} onClick={openLink} />
          {linkOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 flex w-72 items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <input
                autoFocus
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                  if (e.key === "Escape") setLinkOpen(false);
                }}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={applyLink}
                className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                OK
              </button>
            </div>
          )}
        </div>
        <ToolButton icon={G.unlink} title="Havolani olib tashlash" onClick={() => exec("unlink")} />
        <ToolButton
          icon={G.clear}
          title="Formatlashni tozalash"
          onClick={() => {
            exec("removeFormat");
            exec("formatBlock", "<p>");
          }}
        />

        <div className="ml-auto flex items-center">
          <ToolButton
            icon={fullscreen ? G.collapse : G.expand}
            title={fullscreen ? "Oynadan chiqish (Esc)" : "Butun ekran"}
            onClick={() => setFullscreen((f) => !f)}
          />
        </div>
      </div>

      {/* Yozish maydoni */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel || placeholder}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onFocus={refreshState}
        style={fullscreen ? undefined : { minHeight: `${height}px` }}
        className={`rich-content flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none dark:text-slate-100 ${
          fullscreen ? "" : "max-h-[55vh]"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />

      {/* Pastki qator */}
      <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
        <span className="hidden sm:inline">Ctrl+B qalin · Ctrl+I kursiv · Ctrl+K havola</span>
        <span className="tabular-nums">
          {counts.words} so&apos;z · {counts.chars} belgi
        </span>
      </div>
    </div>
  );
}

function Palette({ colors, onPick, onReset }) {
  return (
    <div className="absolute left-0 top-full z-30 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
            className="h-5 w-5 rounded-md border border-black/10 transition hover:scale-110 dark:border-white/20"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onReset}
        className="mt-2 w-full rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        Rangni tiklash
      </button>
    </div>
  );
}
