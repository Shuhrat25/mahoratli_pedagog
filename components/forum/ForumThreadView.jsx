"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";
import { forumApi } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

export default function ForumThreadView({ basePath }) {
  const { currentUser } = useApp();
  const { threadId } = useParams();
  const router = useRouter();
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    forumApi.get(threadId).then(({ thread }) => setThread(thread));
  }, [threadId]);

  if (!thread) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const canModerate = currentUser?.role === "TEACHER" || currentUser?.role === "ADMIN";

  async function addReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    const { thread: updated } = await forumApi.reply(threadId, reply);
    setThread(updated);
    setReply("");
  }

  async function deleteReply(replyId) {
    const { thread: updated } = await forumApi.removeReply(threadId, replyId);
    setThread(updated);
  }

  async function deleteThread() {
    await forumApi.remove(threadId);
    router.push(basePath);
  }

  return (
    <div>
      <button onClick={() => router.push(basePath)} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Forum
      </button>

      <div className="card mb-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{thread.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {thread.authorName} · {new Date(thread.createdAt).toLocaleDateString("uz-UZ")}
            </p>
          </div>
          {(canModerate || thread.authorId === currentUser?.id) && (
            <button onClick={deleteThread} className="text-sm text-red-600 hover:underline">
              O'chirish
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {thread.replies.map((r) => (
          <div key={r.id} className="card flex items-start justify-between gap-2 p-3">
            <div>
              <p className="text-sm">
                <span className="font-medium">{r.authorName}</span>{" "}
                <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString("uz-UZ")}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{r.text}</p>
            </div>
            {(canModerate || r.authorId === currentUser?.id) && (
              <button onClick={() => deleteReply(r.id)} className="shrink-0 text-xs text-red-600 hover:underline">
                O'chirish
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addReply} className="mt-4 flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Javob yozing..." className="input" />
        <button type="submit" className="btn-primary shrink-0">
          Yuborish
        </button>
      </form>
    </div>
  );
}
