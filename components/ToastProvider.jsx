"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Xabarnomalar (toast) va tasdiqlash oynasi.
//
// Ilgari xatolar jim yutilardi (`.catch(() => {})`), o'chirish esa brauzerning
// `window.confirm` oynasi bilan so'ralardi — u sayt dizayniga mos kelmaydi va
// mobil brauzerlarda bloklanishi mumkin.

const ToastContext = createContext(null);

const ICONS = {
  success: "M20 6L9 17l-5-5",
  error: "M12 8v5M12 16h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z",
  info: "M12 16v-4M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
};

const STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200",
  error: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200",
  info: "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, tone = "info", { duration = 4000 } = {}) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const success = useCallback((message, opts) => toast(message, "success", opts), [toast]);
  const error = useCallback((message, opts) => toast(message, "error", opts), [toast]);
  const info = useCallback((message, opts) => toast(message, "info", opts), [toast]);

  /**
   * `window.confirm` o'rnini bosadi: `if (await confirm({...})) { ... }`
   */
  const confirm = useCallback((options) => {
    setConfirmState({
      title: "Tasdiqlaysizmi?",
      confirmLabel: "Ha",
      cancelLabel: "Bekor qilish",
      tone: "danger",
      ...(typeof options === "string" ? { title: options } : options),
    });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function settle(result) {
    setConfirmState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  const value = useMemo(
    () => ({ toast, success, error, info, confirm, dismiss }),
    [toast, success, error, info, confirm, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg ${STYLES[t.tone]}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 h-4 w-4 shrink-0">
              <path d={ICONS[t.tone]} />
            </svg>
            <span className="min-w-0 flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Yopish" className="shrink-0 opacity-60 hover:opacity-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-semibold">{confirmState.title}</h3>
            {confirmState.description && (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{confirmState.description}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => settle(false)} className="btn-secondary">
                {confirmState.cancelLabel}
              </button>
              <button
                autoFocus
                onClick={() => settle(true)}
                className={confirmState.tone === "danger" ? "btn-danger" : "btn-primary"}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast ToastProvider ichida ishlatilishi kerak");
  return ctx;
}
