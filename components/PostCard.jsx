"use client";

import { useState } from "react";
import { postsApi, fileUrl } from "@/lib/api";

export default function PostCard({ post, onUpdate }) {
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  async function toggleLike() {
    const { post: updated } = await postsApi.like(post.id);
    onUpdate(updated);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const { post: updated } = await postsApi.comment(post.id, commentText);
    onUpdate(updated);
    setCommentText("");
  }

  function share() {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
          {post.authorName.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold">{post.authorName}</p>
          <p className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString("uz-UZ")}</p>
        </div>
      </div>
      <h3 className="mb-1.5 text-base font-bold">{post.title}</h3>
      {post.text && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{post.text}</p>
      )}
      {post.videoUrl && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe src={post.videoUrl} title={post.title} className="h-full w-full" allowFullScreen />
        </div>
      )}
      {!post.videoUrl && post.imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(post.imageId)} alt={post.title} className="mt-3 w-full rounded-xl object-cover" />
      )}
      <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 transition-colors ${post.liked ? "text-rose-500" : "hover:text-rose-500"}`}
        >
          <svg viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          {post.likes}
        </button>
        <button onClick={() => setShowComments((s) => !s)} className="flex items-center gap-1.5 hover:text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          {post.comments.length}
        </button>
        <button onClick={share} className="flex items-center gap-1.5 hover:text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path strokeLinecap="round" d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
          </svg>
          Ulashish
        </button>
      </div>
      {showComments && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {post.comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <span className="font-semibold">{c.author}: </span>
              {c.text}
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Izoh yozing..."
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Yuborish
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
