"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";
import { forumApi } from "@/lib/api";
import RichText from "@/components/RichText";
import RichTextEditor from "@/components/RichTextEditor";
import { useToast } from "@/components/ToastProvider";
import { isEmptyHtml } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";

export default function ForumThreadView({ basePath }) {
  const { currentUser } = useApp();
  const { threadId } = useParams();
  const router = useRouter();
  const { success, error: toastError, confirm } = useToast();

  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    forumApi
      .get(threadId)
      .then(({ thread }) => setThread(thread))
      .catch(() => setThread(null));
  }, [threadId]);

  if (!thread) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const canModerate = currentUser?.role === "TEACHER" || currentUser?.role === "ADMIN";
  const isAuthor = thread.authorId === currentUser?.id;
  const canEdit = canModerate || isAuthor;

  async function addReply(e) {
    e.preventDefault();
    if (isEmptyHtml(reply) || sending) return;
    setSending(true);
    try {
      const { thread: updated } = await forumApi.reply(threadId, reply);
      setThread(updated);
      setReply("");
    } catch (err) {
      toastError(err.message || "Javobni yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  }

  async function deleteReply(replyId) {
    const ok = await confirm({ title: "Javob o'chirilsinmi?", confirmLabel: "O'chirish" });
    if (!ok) return;
    try {
      const { thread: updated } = await forumApi.removeReply(threadId, replyId);
      setThread(updated);
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  async function deleteThread() {
    const ok = await confirm({
      title: "Mavzu o'chirilsinmi?",
      description: "Barcha javoblar ham o'chib ketadi.",
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await forumApi.remove(threadId);
      router.push(basePath);
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  function startEdit() {
    setEditTitle(thread.title);
    setEditBody(thread.body || "");
    setEditing(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const { thread: updated } = await forumApi.update(threadId, { title: editTitle, text: editBody });
      setThread(updated);
      setEditing(false);
      success("Mavzu yangilandi");
    } catch (err) {
      toastError(err.message || "Saqlab bo'lmadi");
    }
  }

  return (
    <div>
      <button onClick={() => router.push(basePath)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Forum
      </button>

      <div className="card mb-4 p-4">
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-3">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input" required />
            <RichTextEditor value={editBody} onChange={setEditBody} placeholder="Mavzu matni..." minHeight={160} />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                Saqlash
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Bekor qilish
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold">{thread.title}</h1>
                <p className="mt-1 text-xs text-slate-500">
                  {thread.authorName} · {new Date(thread.createdAt).toLocaleDateString("uz-UZ")}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2 text-sm">
                  <button onClick={startEdit} className="text-brand-700 hover:underline dark:text-brand-400">
                    Tahrirlash
                  </button>
                  <button onClick={deleteThread} className="text-red-600 hover:underline">
                    O&apos;chirish
                  </button>
                </div>
              )}
            </div>
            {thread.body && <RichText value={thread.body} className="mt-3 text-sm text-slate-700 dark:text-slate-300" />}
          </>
        )}
      </div>

      <div className="space-y-3">
        {thread.replies.map((r) => (
          <div key={r.id} className="card flex items-start justify-between gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{r.authorName}</span>{" "}
                <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString("uz-UZ")}</span>
              </p>
              <RichText value={r.text} className="mt-1 text-sm text-slate-700 dark:text-slate-300" />
            </div>
            {(canModerate || r.authorId === currentUser?.id) && (
              <button onClick={() => deleteReply(r.id)} className="shrink-0 text-xs text-red-600 hover:underline">
                O&apos;chirish
              </button>
            )}
          </div>
        ))}
        {thread.replies.length === 0 && <p className="text-sm text-slate-500">Hali javob yo&apos;q — birinchi bo&apos;ling.</p>}
      </div>

      {/* Javob maydoni ikkala rol uchun ham rich-text — forum yagona joy
          bo'lib, u yerda talaba ham formatlab yoza oladi. */}
      <form onSubmit={addReply} className="mt-4 space-y-2">
        <RichTextEditor compact value={reply} onChange={setReply} placeholder="Javob yozing..." ariaLabel="Forum javobi" />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>
      </form>
    </div>
  );
}
