"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { bannersApi, postsApi, pollsApi, fileUrl, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import RichText from "@/components/RichText";
import RichTextEditor from "@/components/RichTextEditor";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/ToastProvider";
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
  const { success, error: toastError, confirm } = useToast();
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
      success(editing ? "Banner yangilandi" : "Banner qo'shildi");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }
  async function remove(banner) {
    const ok = await confirm({
      title: "Banner o'chirilsinmi?",
      description: banner.title,
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await bannersApi.remove(banner.id);
      await reload();
      success("Banner o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }
  async function move(id, dir) {
    try {
      const { banners: updated } = await bannersApi.move(id, dir);
      setBanners(updated);
    } catch (err) {
      toastError(err.message || "Ko'chirib bo'lmadi");
    }
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Banner qo&apos;shish
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
              <button onClick={() => remove(b)} className="rounded px-2 py-1 text-xs hover:bg-white/20">
                O&apos;chirish
              </button>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="text-sm text-slate-500">Hali banner qo&apos;shilmagan.</p>}
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

/** datetime-local uchun mahalliy vaqt (toISOString UTCga o'tkazib yuboradi). */
function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

const POST_FILTERS = [
  { id: "", label: "Barchasi" },
  { id: "PUBLISHED", label: "E'lon qilingan" },
  { id: "DRAFT", label: "Qoralamalar" },
];

function PostsTab() {
  const { success, error: toastError, confirm } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [image, setImage] = useState(null);
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("PUBLISHED");
  const [publishedAt, setPublishedAt] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const reload = useCallback(async () => {
    const data = await postsApi.list({ page, limit: 10, status: statusFilter, search });
    setPosts(data.posts);
    setPages(data.pages);
  }, [page, statusFilter, search]);

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

  function openCreate() {
    setEditing(null);
    setTitle("");
    setText("");
    setVideoUrl("");
    setImage(null);
    setTags("");
    setStatus("PUBLISHED");
    setPublishedAt("");
    setPinned(false);
    setFormError("");
    setOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setTitle(p.title);
    setText(p.text || "");
    setVideoUrl(p.videoUrl || "");
    setImage(null);
    setTags((p.tags || []).join(", "));
    setStatus(p.status);
    setPublishedAt(toLocalInput(p.publishedAt));
    setPinned(!!p.pinned);
    setFormError("");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title,
        text: text || undefined,
        videoUrl: videoUrl ? toYoutubeEmbed(videoUrl) : undefined,
        image: image || undefined,
        tags,
        status,
        pinned: String(pinned),
        // Bo'sh bo'lsa — server "hozir" deb qo'yadi.
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      };
      if (editing) await postsApi.update(editing.id, payload);
      else await postsApi.create(payload);
      await reload();
      setOpen(false);
      success(status === "DRAFT" ? "Qoralama saqlandi" : "Post e'lon qilindi");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function remove(post) {
    const ok = await confirm({ title: "Post o'chirilsinmi?", description: post.title, confirmLabel: "O'chirish" });
    if (!ok) return;
    try {
      await postsApi.remove(post.id);
      await reload();
      success("Post o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  async function togglePinned(post) {
    try {
      await postsApi.update(post.id, { pinned: String(!post.pinned) });
      await reload();
    } catch (err) {
      toastError(err.message || "Xatolik yuz berdi");
    }
  }

  async function publishNow(post) {
    try {
      await postsApi.update(post.id, { status: "PUBLISHED", publishedAt: new Date().toISOString() });
      await reload();
      success("Post e'lon qilindi");
    } catch (err) {
      toastError(err.message || "Xatolik yuz berdi");
    }
  }

  function statusBadge(p) {
    if (p.status === "DRAFT") {
      return <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Qoralama</span>;
    }
    if (p.publishedAt && new Date(p.publishedAt) > new Date()) {
      return (
        <span className="badge bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          {new Date(p.publishedAt).toLocaleString("uz-UZ")} da
        </span>
      );
    }
    return <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">E&apos;lon qilingan</span>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {POST_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              onClick={() => {
                setStatusFilter(f.id);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative">
            <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Qidirish..."
              className="input w-48 pl-9"
            />
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Post qo&apos;shish
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {statusBadge(p)}
                  {p.pinned && <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">📌</span>}
                  <span className="text-sm text-slate-500">
                    {p.authorName} · {p.readingMinutes} daq.
                  </span>
                </div>
                <p className="font-semibold">
                  <Link href={`/post/${p.id}`} className="hover:underline">
                    {p.title}
                  </Link>
                </p>
                {p.text && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    {truncate(plainTextFromHtml(p.text), 180)}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      #{t}
                    </span>
                  ))}
                  {(p.videoUrl || p.imageId) && (
                    <span className="text-xs text-indigo-500">{p.videoUrl ? "🎬 Video" : "🖼 Rasm"}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {p.status === "DRAFT" && (
                  <button onClick={() => publishNow(p)} className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                    E&apos;lon qilish
                  </button>
                )}
                <button
                  onClick={() => togglePinned(p)}
                  title={p.pinned ? "Qadashni bekor qilish" : "Tepaga qadash"}
                  className="rounded-lg px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  📌
                </button>
                <KebabMenu onEdit={() => openEdit(p)} onDelete={() => remove(p)} />
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              Post topilmadi.
            </p>
          )}
        </div>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} className="mt-4" />

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
            <label className="label">Ruknlar (vergul bilan ajrating)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input"
              placeholder="metodika, komiks, e'lon"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Holati</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="PUBLISHED">E&apos;lon qilish</option>
                <option value="DRAFT">Qoralama (faqat siz ko&apos;rasiz)</option>
              </select>
            </div>
            <div>
              <label className="label">E&apos;lon vaqti (ixtiyoriy)</label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="input"
                disabled={status === "DRAFT"}
              />
              <p className="mt-1 text-xs text-slate-500">
                Kelajakdagi vaqt tanlansa, post o&apos;sha paytda avtomatik ko&apos;rinadi.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Lentaning tepasiga qadash
          </label>
          <div>
            <label className="label">YouTube video havolasi (ixtiyoriy — video bo&apos;lsa, rasm o&apos;rniga shu ko&apos;rsatiladi)</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="input" placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="label">Muqova rasmi (ixtiyoriy — ulashishda ham shu ko&apos;rinadi)</label>
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
  const { success, error: toastError, confirm } = useToast();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [multiple, setMultiple] = useState(false);
  const [isQuiz, setIsQuiz] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  function reload() {
    return pollsApi.list().then(({ polls }) => setPolls(polls));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function addOption() {
    setOptions((o) => [...o, ""]);
  }
  function removeOption(i) {
    setOptions((o) => (o.length <= 2 ? o : o.filter((_, idx) => idx !== i)));
    setCorrectIdx((idx) => (idx >= i && idx > 0 ? idx - 1 : idx));
  }
  function updateOption(i, val) {
    setOptions((o) => o.map((x, idx) => (idx === i ? val : x)));
  }

  async function save(e) {
    e.preventDefault();
    const cleanOptions = options.filter((o) => o.trim());
    if (cleanOptions.length < 2) {
      toastError("Kamida 2 ta variant kerak");
      return;
    }
    setSaving(true);
    try {
      await pollsApi.create({
        question,
        multiple,
        // To'g'ri javob faqat "viktorina" rejimida belgilanadi — oddiy
        // so'rovnomada to'g'ri javob tushunchasi yo'q.
        options: cleanOptions.map((text, i) => ({ text, correct: isQuiz && i === correctIdx })),
      });
      await reload();
      setOpen(false);
      setQuestion("");
      setOptions(["", ""]);
      setCorrectIdx(0);
      setIsQuiz(false);
      setMultiple(false);
      success("So'rovnoma yaratildi");
    } catch (err) {
      toastError(err.message || "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function remove(poll) {
    const ok = await confirm({ title: "So'rovnoma o'chirilsinmi?", description: poll.question, confirmLabel: "O'chirish" });
    if (!ok) return;
    try {
      await pollsApi.remove(poll.id);
      await reload();
      success("So'rovnoma o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> So&apos;rovnoma yaratish
        </button>
      </div>
      <div className="space-y-3">
        {polls.map((p) => {
          const total = p.options.reduce((s, o) => s + o.votes, 0);
          return (
            <div key={p.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.question}</p>
                  <p className="text-xs text-slate-500">
                    {p.quiz ? "Viktorina" : "So'rovnoma"} · {total} ovoz
                    {p.multiple && " · bir nechta javob"}
                  </p>
                </div>
                <button onClick={() => remove(p)} className="shrink-0 text-xs text-red-600 hover:underline">
                  O&apos;chirish
                </button>
              </div>
              <ul className="space-y-1 text-sm text-slate-500">
                {p.options.map((o) => (
                  <li key={o.id} className={o.correct ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}>
                    {o.text} — {total ? Math.round((o.votes / total) * 100) : 0}% ({o.votes})
                    {o.correct && " ✓"}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {polls.length === 0 && <p className="text-sm text-slate-500">Hali so&apos;rovnoma yaratilmagan.</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="So'rovnoma yaratish" wide>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Savol</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className="input" required />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
              Bir nechta javob tanlash mumkin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isQuiz} onChange={(e) => setIsQuiz(e.target.checked)} />
              Viktorina (to&apos;g&apos;ri javob bor)
            </label>
          </div>
          <div className="space-y-2">
            <label className="label">Variantlar</label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                {isQuiz && (
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIdx === i}
                    onChange={() => setCorrectIdx(i)}
                    title="To'g'ri javob"
                  />
                )}
                <input value={o} onChange={(e) => updateOption(i, e.target.value)} className="input" placeholder={`Variant ${i + 1}`} required />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} aria-label="Variantni olib tashlash" className="shrink-0 text-slate-400 hover:text-rose-600">
                    <Icon path="M18 6L6 18M6 6l12 12" className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addOption} className="text-sm text-brand-700 hover:underline dark:text-brand-400">
              + Variant qo&apos;shish
            </button>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Yaratish"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
