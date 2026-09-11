"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { forumApi } from "@/lib/api";
import Modal from "@/components/Modal";
import RichTextEditor from "@/components/RichTextEditor";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";
import { plainTextFromHtml, truncate } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";

export default function ForumList({ basePath }) {
  const { success, error: toastError } = useToast();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const reload = useCallback(async () => {
    const data = await forumApi.list({ page, limit: 20, search });
    setThreads(data.threads);
    setPages(data.pages);
    setTotal(data.total);
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  async function createThread(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await forumApi.create({ title, text });
      setTitle("");
      setText("");
      setOpen(false);
      setPage(1);
      await reload();
      success("Mavzu yaratildi");
    } catch (err) {
      toastError(err.message || "Mavzuni yaratib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Forum</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Mavzulardan qidirish..."
              className="input w-56 pl-9"
            />
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Icon path={paths.plus} className="h-4 w-4" /> Yangi mavzu
          </button>
        </div>
      </div>

      {search && <p className="mb-3 text-sm text-slate-500">{total} ta natija — &quot;{search}&quot;</p>}

      {loading ? (
        <div className="text-slate-400">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link key={t.id} href={`${basePath}/${t.id}`} className="card block p-4 hover:border-brand-300">
              <p className="font-medium">{t.title}</p>
              {t.body && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                  {truncate(plainTextFromHtml(t.body), 160)}
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                {t.authorName} · {new Date(t.createdAt).toLocaleDateString("uz-UZ")} · {t.replies.length} javob
              </p>
            </Link>
          ))}
          {threads.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              {search ? "Hech narsa topilmadi." : "Hali mavzu yaratilmagan."}
            </p>
          )}
        </div>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} className="mt-4" />

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi mavzu yaratish" wide>
        <form onSubmit={createThread} className="space-y-3">
          <div>
            <label className="label">Sarlavha</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Matn (ixtiyoriy)</label>
            {/* Forum — talabalar ham rich-text bilan yozadigan yagona joy:
                savolni tushunarli qilish uchun ro'yxat, iqtibos va havola kerak
                bo'ladi. Qolgan talaba maydonlari (izohlar va h.k.) oddiy matn. */}
            <RichTextEditor value={text} onChange={setText} placeholder="Mavzu bo'yicha batafsil..." ariaLabel="Mavzu matni" minHeight={160} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Yaratish"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
