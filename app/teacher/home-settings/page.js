"use client";

import { useEffect, useState } from "react";
import { bannersApi, postsApi, pollsApi, fileUrl, ApiError } from "@/lib/api";
import { useApp } from "@/lib/auth-context";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import RichText from "@/components/RichText";
import RichTextEditor from "@/components/RichTextEditor";
import { isEmptyHtml, plainTextFromHtml, truncate } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";

const TABS = [
  { id: "banners", label: "Banner" },
  { id: "posts", label: "Postlar" },
  { id: "polls", label: "So'rovnomalar" },
];

export default function HomeSettingsPage() {
  const [tab, setTab] = useState("banners");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Bosh sahifa sozlamalari</h1>
      <div className="mb-4 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-brand-600 text-brand-700 dark:text-brand-400" : "border-transparent text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "banners" && <BannersTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "polls" && <PollsTab />}
    </div>
  );
}

function BannersTab() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function reload() {
    return bannersApi.list().then(({ banners }) => setBanners(banners));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setText("");
    setImage(null);
    setFormError("");
    setOpen(true);
  }
  function openEdit(b) {
    setEditing(b);
    setTitle(b.title);
    setText(b.text);
    setImage(null);
    setFormError("");
    setOpen(true);
  }
  async function save(e) {
    e.preventDefault();
    // Matn maydoni endi contentEditable — brauzerning `required` tekshiruvi
    // unga ta'sir qilmaydi, shuning uchun qo'lda tekshiramiz.
    if (isEmptyHtml(text)) {
      setFormError("Banner matnini to'ldiring");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await bannersApi.update(editing.id, { title, text, image: image || undefined });
      } else {
        await bannersApi.create({ title, text, image: image || undefined });
      }
      await reload();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }
  async function remove(id) {
    await bannersApi.remove(id);
    await reload();
  }
  async function move(id, dir) {
    const { banners: updated } = await bannersApi.move(id, dir);
    setBanners(updated);
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Banner qo'shish
        </button>
      </div>
      <div className="space-y-3">
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={`card relative flex items-center gap-4 overflow-hidden bg-cover bg-center p-4 text-white ${
              b.imageId ? "" : `bg-gradient-to-br ${b.color}`
            }`}
            style={b.imageId ? { backgroundImage: `url(${fileUrl(b.imageId)})` } : undefined}
          >
            {b.imageId && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative min-w-0 flex-1">
              <p className="font-semibold">{b.title}</p>
              <RichText value={b.text} inline className="text-sm text-white/90" />
            </div>
            <div className="relative flex shrink-0 items-center gap-1">
              <button onClick={() => move(b.id, -1)} disabled={i === 0} className="rounded p-1 hover:bg-white/20 disabled:opacity-30">
                <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />
              </button>
              <button onClick={() => move(b.id, 1)} disabled={i === banners.length - 1} className="rounded p-1 hover:bg-white/20 disabled:opacity-30">
                <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />
              </button>
              <button onClick={() => openEdit(b)} className="rounded px-2 py-1 text-xs hover:bg-white/20">
                Tahrirlash
              </button>
              <button onClick={() => remove(b.id)} className="rounded px-2 py-1 text-xs hover:bg-white/20">
                O'chirish
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Bannerni tahrirlash" : "Banner qo'shish"}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Sarlavha</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Matn</label>
            <RichTextEditor
              compact
              value={text}
              onChange={setText}
              placeholder="Banner ostidagi qisqa matn..."
              ariaLabel="Banner matni"
            />
          </div>
          <div>
            <label className="label">Fon rasmi (ixtiyoriy — tanlanmasa, rangli fon ishlatiladi)</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="input" />
            {editing?.imageId && !image && (
              <p className="mt-1 text-xs text-slate-500">Yangi rasm tanlanmasa, joriy rasm saqlanadi.</p>
            )}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function toYoutubeEmbed(url) {
  if (!url) return "";
  if (url.includes("/embed/")) return url;
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function reload() {
    return postsApi.list().then(({ posts }) => setPosts(posts));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setText("");
    setVideoUrl("");
    setImage(null);
    setFormError("");
    setOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setTitle(p.title);
    setText(p.text || "");
    setVideoUrl(p.videoUrl || "");
    setImage(null);
    setFormError("");
    setOpen(true);
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = { title, text: text || undefined, videoUrl: videoUrl ? toYoutubeEmbed(videoUrl) : undefined, image: image || undefined };
      if (editing) await postsApi.update(editing.id, payload);
      else await postsApi.create(payload);
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }
  async function remove(id) {
    await postsApi.remove(id);
    await reload();
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Post qo'shish
        </button>
      </div>
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="card flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">
                {p.authorName} · {new Date(p.createdAt).toLocaleDateString("uz-UZ")}
              </p>
              <p className="mt-1 font-semibold">{p.title}</p>
              {p.text && (
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                  {truncate(plainTextFromHtml(p.text), 180)}
                </p>
              )}
              {(p.videoUrl || p.imageId) && (
                <p className="mt-1 text-xs text-indigo-500">{p.videoUrl ? "🎬 Video biriktirilgan" : "🖼 Rasm biriktirilgan"}</p>
              )}
            </div>
            <KebabMenu onEdit={() => openEdit(p)} onDelete={() => remove(p.id)} />
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Postni tahrirlash" : "Post qo'shish"} wide>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Sarlavha</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Post matni (ixtiyoriy)</label>
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder="Post matni — sarlavhalar, ro'yxatlar, havolalar va rangli ajratmalar bilan..."
              ariaLabel="Post matni"
              minHeight={240}
            />
          </div>
          <div>
            <label className="label">YouTube video havolasi (ixtiyoriy — video bo'lsa, rasm o'rniga shu ko'rsatiladi)</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="input" placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="label">Rasm (ixtiyoriy)</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="input" />
            {editing?.imageId && !image && (
              <p className="mt-1 text-xs text-slate-500">Yangi rasm tanlanmasa, joriy rasm saqlanadi.</p>
            )}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function PollsTab() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [multiple, setMultiple] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);

  function reload() {
    return pollsApi.list().then(({ polls }) => setPolls(polls));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function addOption() {
    setOptions((o) => [...o, ""]);
  }
  function updateOption(i, val) {
    setOptions((o) => o.map((x, idx) => (idx === i ? val : x)));
  }
  async function save(e) {
    e.preventDefault();
    const cleanOptions = options.filter((o) => o.trim());
    await pollsApi.create({
      question,
      multiple,
      options: cleanOptions.map((text, i) => ({ text, correct: i === correctIdx })),
    });
    await reload();
    setOpen(false);
    setQuestion("");
    setOptions(["", ""]);
    setCorrectIdx(0);
  }
  async function remove(id) {
    await pollsApi.remove(id);
    await reload();
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> So'rovnoma yaratish
        </button>
      </div>
      <div className="space-y-3">
        {polls.map((p) => {
          const total = p.options.reduce((s, o) => s + o.votes, 0);
          return (
            <div key={p.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium">{p.question}</p>
                <button onClick={() => remove(p.id)} className="shrink-0 text-xs text-red-600 hover:underline">
                  O'chirish
                </button>
              </div>
              <ul className="space-y-1 text-sm text-slate-500">
                {p.options.map((o) => (
                  <li key={o.id}>
                    {o.text} — {total ? Math.round((o.votes / total) * 100) : 0}% ({o.votes})
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="So'rovnoma yaratish" wide>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Savol</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className="input" required />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} id="multi" />
            <label htmlFor="multi" className="text-sm">
              Bir nechta javob tanlash mumkin
            </label>
          </div>
          <div className="space-y-2">
            <label className="label">Variantlar</label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIdx === i}
                  onChange={() => setCorrectIdx(i)}
                  title="To'g'ri javob"
                />
                <input value={o} onChange={(e) => updateOption(i, e.target.value)} className="input" placeholder={`Variant ${i + 1}`} required />
              </div>
            ))}
            <button type="button" onClick={addOption} className="text-sm text-brand-700 hover:underline dark:text-brand-400">
              + Variant qo'shish
            </button>
          </div>
          <button type="submit" className="btn-primary w-full">
            Yaratish
          </button>
        </form>
      </Modal>
    </div>
  );
}
