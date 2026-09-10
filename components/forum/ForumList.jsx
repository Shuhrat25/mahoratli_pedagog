"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { forumApi } from "@/lib/api";
import { useApp } from "@/lib/auth-context";
import Modal from "@/components/Modal";
import RichTextEditor from "@/components/RichTextEditor";
import { Icon, paths } from "@/components/icons";

export default function ForumList({ basePath }) {
  const { currentUser } = useApp();
  // Rich-text tahrirlagich faqat o'qituvchi/admin kabinetida — talabalar
  // uchun oddiy maydon qoladi (forum sahifasi ikkala rol uchun umumiy).
  const isStaff = currentUser?.role === "TEACHER" || currentUser?.role === "ADMIN";
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    forumApi.list().then(({ threads }) => setThreads(threads)).finally(() => setLoading(false));
  }, []);

  async function createThread(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const { thread } = await forumApi.create({ title, text });
    setThreads((prev) => [thread, ...prev]);
    setTitle("");
    setText("");
    setOpen(false);
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Forum</h1>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Yangi mavzu
        </button>
      </div>

      <div className="space-y-2">
        {threads.map((t) => (
          <Link key={t.id} href={`${basePath}/${t.id}`} className="card block p-4 hover:border-brand-300">
            <p className="font-medium">{t.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t.authorName} · {new Date(t.createdAt).toLocaleDateString("uz-UZ")} · {t.replies.length} javob
            </p>
          </Link>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi mavzu yaratish">
        <form onSubmit={createThread} className="space-y-3">
          <div>
            <label className="label">Sarlavha</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Matn (ixtiyoriy)</label>
            {isStaff ? (
              <RichTextEditor value={text} onChange={setText} placeholder="Mavzu bo'yicha batafsil..." ariaLabel="Mavzu matni" minHeight={160} />
            ) : (
              <textarea value={text} onChange={(e) => setText(e.target.value)} className="input" rows={4} />
            )}
          </div>
          <button type="submit" className="btn-primary w-full">
            Yaratish
          </button>
        </form>
      </Modal>
    </div>
  );
}
