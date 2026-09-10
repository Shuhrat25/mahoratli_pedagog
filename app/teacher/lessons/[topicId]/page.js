"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { topicsApi, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import RichTextEditor from "@/components/RichTextEditor";
import { isEmptyHtml } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";

const TYPE_LABEL = { VIDEO: "Video", TEXT: "Matn", TEST: "Test" };

export default function TeacherTopicLessonsPage() {
  const { topicId } = useParams();
  const router = useRouter();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [lessonType, setLessonType] = useState("VIDEO");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [content, setContent] = useState("");
  const [testFile, setTestFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function reload() {
    return topicsApi.list().then(({ topics }) => {
      const found = topics.find((t) => t.id === topicId);
      setTopic(found || null);
    });
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [topicId]);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  if (!topic) return <p>Mavzu topilmadi.</p>;

  function openCreate() {
    setEditing(null);
    setLessonType("VIDEO");
    setTitle("");
    setVideoUrl("");
    setContent("");
    setTestFile(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(lesson) {
    setEditing(lesson);
    setLessonType(lesson.type);
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl || "");
    setContent(lesson.content || "");
    setTestFile(null);
    setFormError("");
    setOpen(true);
  }

  function toYoutubeEmbed(url) {
    if (!url) return "";
    if (url.includes("/embed/")) return url;
    const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }

  async function save(e) {
    e.preventDefault();
    // Matnli dars uchun mazmun majburiy — contentEditable'da brauzerning
    // `required` tekshiruvi ishlamaydi, shuning uchun qo'lda tekshiramiz.
    if (lessonType === "TEXT" && !editing && isEmptyHtml(content)) {
      setFormError("Dars matnini to'ldiring");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      let lessonId = editing?.id;
      if (lessonType === "VIDEO") {
        const payload = { title, type: "VIDEO", videoUrl: toYoutubeEmbed(videoUrl), content };
        if (editing) await topicsApi.updateLesson(topicId, editing.id, payload);
        else lessonId = (await topicsApi.createLesson(topicId, payload)).lesson.id;
      } else if (lessonType === "TEXT") {
        const payload = { title, type: "TEXT", content };
        if (editing) await topicsApi.updateLesson(topicId, editing.id, payload);
        else lessonId = (await topicsApi.createLesson(topicId, payload)).lesson.id;
      } else {
        const payload = { title, type: "TEST" };
        if (editing) await topicsApi.updateLesson(topicId, editing.id, payload);
        else lessonId = (await topicsApi.createLesson(topicId, payload)).lesson.id;

        if (testFile) {
          const formData = new FormData();
          formData.append("file", testFile);
          await topicsApi.importTest(topicId, lessonId, formData);
        }
      }
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function remove(lessonId) {
    if (!window.confirm("Dars o'chirilsinmi?")) return;
    await topicsApi.removeLesson(topicId, lessonId);
    await reload();
  }

  async function move(lessonId, dir) {
    await topicsApi.moveLesson(topicId, lessonId, dir);
    await reload();
  }

  return (
    <div>
      <button onClick={() => router.push("/teacher/lessons")} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Mavzular ro'yxati
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{topic.title}</h1>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Dars yaratish
        </button>
      </div>

      <div className="space-y-2">
        {topic.lessons.map((lesson, i) => (
          <div key={lesson.id} className="card flex items-center gap-3 p-4">
            <div className="flex flex-col">
              <button onClick={() => move(lesson.id, -1)} disabled={i === 0} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">
                <Icon path="M5 15l7-7 7 7" className="h-4 w-4" />
              </button>
              <button onClick={() => move(lesson.id, 1)} disabled={i === topic.lessons.length - 1} className="text-slate-400 hover:text-brand-600 disabled:opacity-30">
                <Icon path="M19 9l-7 7-7-7" className="h-4 w-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{lesson.title}</p>
              <p className="text-xs uppercase text-slate-500">
                {TYPE_LABEL[lesson.type]} {lesson.type === "TEST" && `· ${lesson.questions?.length || 0} savol`}
              </p>
            </div>
            <KebabMenu onEdit={() => openEdit(lesson)} onDelete={() => remove(lesson.id)} />
          </div>
        ))}
        {topic.lessons.length === 0 && <p className="text-sm text-slate-500">Hali dars qo'shilmagan.</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Darsni tahrirlash" : "Dars yaratish"} wide>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Dars nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Turi</label>
            <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} className="input" disabled={!!editing}>
              <option value="VIDEO">Video</option>
              <option value="TEXT">Matn</option>
              <option value="TEST">Test</option>
            </select>
          </div>

          {lessonType === "VIDEO" && (
            <div className="space-y-3">
              <div>
                <label className="label">YouTube havolasi</label>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="input" placeholder="https://youtube.com/watch?v=..." required={!editing} />
              </div>
              <div>
                <label className="label">Tavsif (ixtiyoriy)</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Video haqida qisqacha tavsif, asosiy tushunchalar, havolalar..."
                  ariaLabel="Video darsi tavsifi"
                  minHeight={160}
                />
              </div>
            </div>
          )}

          {lessonType === "TEXT" && (
            <div>
              <label className="label">Dars matni</label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Dars matni — sarlavhalar, ro'yxatlar, iqtiboslar va havolalar bilan..."
                ariaLabel="Dars matni"
                minHeight={280}
              />
            </div>
          )}

          {lessonType === "TEST" && (
            <div>
              <label className="label">
                Test fayli (DOCX, PDF yoki TXT) — <code>~</code> to'g'ri, <code>==</code> noto'g'ri, <code>++++</code> ajratuvchi formatida
              </label>
              <input
                type="file"
                accept=".docx,.pdf,.txt"
                onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                className="input"
              />
              {editing && (
                <p className="mt-1 text-xs text-slate-500">
                  Fayl tanlanmasa, mavjud {editing.questions?.length || 0} savol saqlanadi. Yangi fayl yuklansa, eski savollar almashtiriladi.
                </p>
              )}
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
