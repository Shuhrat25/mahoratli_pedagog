"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { topicsApi } from "@/lib/api";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import { useToast } from "@/components/ToastProvider";
import { Icon, paths } from "@/components/icons";

export default function TeacherLessonsPage() {
  const { success, error: toastError, confirm } = useToast();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");

  function reload() {
    return topicsApi.list().then(({ topics }) => setTopics([...topics].sort((a, b) => a.order - b.order)));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  function openCreate() {
    setEditing(null);
    setTitle("");
    setOpen(true);
  }
  function openEdit(t) {
    setEditing(t);
    setTitle(t.title);
    setOpen(true);
  }
  async function save(e) {
    e.preventDefault();
    if (editing) {
      await topicsApi.update(editing.id, title);
    } else {
      await topicsApi.create(title);
    }
    await reload();
    setOpen(false);
  }
  async function remove(topic) {
    const ok = await confirm({
      title: "Mavzu o'chirilsinmi?",
      description: `${topic.title} — undagi ${topic.lessons.length} ta dars ham o'chadi.`,
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await topicsApi.remove(topic.id);
      await reload();
      success("Mavzu o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }
  async function move(id, dir) {
    await topicsApi.move(id, dir);
    await reload();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Darslar</h1>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Mavzu yaratish
        </button>
      </div>

      <div className="space-y-2">
        {topics.map((t, i) => (
          <div key={t.id} className="card flex items-center gap-3 p-4">
            <div className="flex flex-col">
              <button onClick={() => move(t.id, -1)} disabled={i === 0} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">
                <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />
              </button>
              <button onClick={() => move(t.id, 1)} disabled={i === topics.length - 1} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">
                <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />
              </button>
            </div>
            <Link href={`/teacher/lessons/${t.id}`} className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-slate-500">{t.lessons.length} dars</p>
            </Link>
            <KebabMenu onEdit={() => openEdit(t)} onDelete={() => remove(t)} />
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Mavzuni tahrirlash" : "Mavzu yaratish"}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Mavzu nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <button type="submit" className="btn-primary w-full">
            Saqlash
          </button>
        </form>
      </Modal>
    </div>
  );
}
