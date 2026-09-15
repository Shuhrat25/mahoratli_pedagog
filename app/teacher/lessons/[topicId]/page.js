"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { topicsApi, fileUrl, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import RichTextEditor from "@/components/RichTextEditor";
import { useToast } from "@/components/ToastProvider";
import { formatDuration } from "@/lib/formatDuration";
import { isEmptyHtml } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";
import PuzzleImagesField from "@/components/puzzle/PuzzleImagesField";
import { downscaleImage } from "@/lib/imageResize";

const TYPE_LABEL = { VIDEO: "Video", TEXT: "Matn", TEST: "Test", LIVE: "Jonli dars", PUZZLE: "Pazl" };
const TYPE_BADGE = {
  VIDEO: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  TEXT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  TEST: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  LIVE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  PUZZLE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function TeacherTopicLessonsPage() {
  const { topicId } = useParams();
  const router = useRouter();
  const { success, error: toastError, confirm } = useToast();

  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [lessonType, setLessonType] = useState("VIDEO");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [content, setContent] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [passScore, setPassScore] = useState(60);
  const [timeLimitMin, setTimeLimitMin] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState("");
  const [testFile, setTestFile] = useState(null);
  const [materialFiles, setMaterialFiles] = useState(null);
  const [puzzlePoints, setPuzzlePoints] = useState("");
  const [puzzleFiles, setPuzzleFiles] = useState([]);
  const [puzzleExisting, setPuzzleExisting] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function reload() {
    return topicsApi.list().then(({ topics }) => {
      const found = topics.find((t) => t.id === topicId) || null;
      setTopic(found);
      return found;
    });
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [topicId]);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;
  if (!topic) return <p>Mavzu topilmadi.</p>;

  function resetForm() {
    setTitle("");
    setVideoUrl("");
    setContent("");
    setMeetingUrl("");
    setStartsAt("");
    setPassScore(60);
    setTimeLimitMin("");
    setShuffle(false);
    setMaxAttempts("");
    setTestFile(null);
    setMaterialFiles(null);
    setPuzzlePoints("");
    setPuzzleFiles([]);
    setPuzzleExisting([]);
    setUploadProgress(null);
    setFormError("");
  }

  function openCreate() {
    setEditing(null);
    setLessonType("VIDEO");
    resetForm();
    setOpen(true);
  }

  function openEdit(lesson) {
    setEditing(lesson);
    setLessonType(lesson.type);
    resetForm();
    setTitle(lesson.title);
    setVideoUrl(lesson.videoUrl || "");
    setContent(lesson.content || "");
    setMeetingUrl(lesson.meetingUrl || "");
    setStartsAt(toLocalInput(lesson.startsAt));
    setPassScore(lesson.passScore ?? 60);
    setTimeLimitMin(lesson.timeLimitSec ? Math.round(lesson.timeLimitSec / 60) : "");
    setShuffle(!!lesson.shuffle);
    setMaxAttempts(lesson.maxAttempts || "");
    setPuzzlePoints(lesson.puzzlePoints || "");
    setPuzzleExisting(lesson.puzzleImages || []);
    setOpen(true);
  }

  function toYoutubeEmbed(url) {
    if (!url) return "";
    if (url.includes("/embed/")) return url;
    const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }

  // Rasmlar bittadan yuklanadi: jarayon ko'rinib turadi va bitta rasm xato
  // bersa, oldingilari saqlanib qoladi (qolganlarini qayta yuborish mumkin).
  async function uploadPuzzleImages(lessonId) {
    const queue = [...puzzleFiles];
    setUploadProgress({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      const fd = new FormData();
      fd.append("images", await downscaleImage(queue[i]));
      try {
        const { puzzleImages } = await topicsApi.addPuzzleImages(topicId, lessonId, fd);
        setPuzzleExisting(puzzleImages);
        setPuzzleFiles(queue.slice(i + 1));
        setUploadProgress({ done: i + 1, total: queue.length });
      } catch (err) {
        throw new ApiError(`"${queue[i].name}" yuklanmadi: ${err.message}`, err.status);
      }
    }
    setUploadProgress(null);
  }

  async function removePuzzleImage(image) {
    const ok = await confirm({
      title: "Rasm o'chirilsinmi?",
      description: "Talabalarning shu rasm bo'yicha natijalari ham o'chadi.",
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await topicsApi.removePuzzleImage(topicId, editing.id, image.id);
      setPuzzleExisting((list) => list.filter((img) => img.id !== image.id));
      reload();
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  async function save(e) {
    e.preventDefault();
    let lessonId = editing?.id;
    if (lessonType === "TEXT" && !editing && isEmptyHtml(content)) {
      setFormError("Dars matnini to'ldiring");
      return;
    }
    if (lessonType === "LIVE" && !meetingUrl.trim()) {
      setFormError("Jonli dars uchun uchrashuv havolasi kerak");
      return;
    }
    if (lessonType === "PUZZLE" && puzzleExisting.length + puzzleFiles.length === 0) {
      setFormError("Pazl uchun kamida bitta rasm qo'shing");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const common = {
        title,
        passScore: Number(passScore) || 60,
        timeLimitSec: timeLimitMin ? Number(timeLimitMin) * 60 : null,
        shuffle,
        maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      };

      let payload;
      if (lessonType === "VIDEO") {
        payload = { ...common, type: "VIDEO", videoUrl: toYoutubeEmbed(videoUrl), content };
      } else if (lessonType === "TEXT") {
        payload = { ...common, type: "TEXT", content };
      } else if (lessonType === "LIVE") {
        payload = {
          ...common,
          type: "LIVE",
          meetingUrl: meetingUrl.trim(),
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          content,
        };
      } else if (lessonType === "PUZZLE") {
        payload = {
          ...common,
          type: "PUZZLE",
          content,
          // Bo'sh qoldirilsa ball berilmaydi.
          puzzlePoints: puzzlePoints ? Number(puzzlePoints) : null,
        };
      } else {
        payload = { ...common, type: "TEST" };
      }

      if (editing) await topicsApi.updateLesson(topicId, editing.id, payload);
      else lessonId = (await topicsApi.createLesson(topicId, payload)).lesson.id;

      if (lessonType === "PUZZLE" && puzzleFiles.length > 0) {
        await uploadPuzzleImages(lessonId);
      }

      if (lessonType === "TEST" && testFile) {
        const fd = new FormData();
        fd.append("file", testFile);
        await topicsApi.importTest(topicId, lessonId, fd);
      }

      if (materialFiles && materialFiles.length > 0) {
        const fd = new FormData();
        Array.from(materialFiles).forEach((f) => fd.append("files", f));
        await topicsApi.addMaterials(topicId, lessonId, fd);
      }

      await reload();
      setOpen(false);
      success(editing ? "Dars yangilandi" : "Dars yaratildi");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setUploadProgress(null);
      // Dars yaratilib, rasmlarning bir qismi yuklanmay qolgan bo'lsa — forma
      // tahrirlash rejimiga o'tadi, qayta "Saqlash" dublikat dars yaratmaydi.
      if (!editing && lessonId) {
        const fresh = await reload().catch(() => null);
        const created = fresh?.lessons.find((l) => l.id === lessonId);
        if (created) setEditing(created);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(lesson) {
    const ok = await confirm({ title: "Dars o'chirilsinmi?", description: lesson.title, confirmLabel: "O'chirish" });
    if (!ok) return;
    try {
      await topicsApi.removeLesson(topicId, lesson.id);
      await reload();
      success("Dars o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  async function removeMaterial(lessonId, materialId) {
    try {
      await topicsApi.removeMaterial(topicId, lessonId, materialId);
      await reload();
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  async function move(lessonId, dir) {
    try {
      await topicsApi.moveLesson(topicId, lessonId, dir);
      await reload();
    } catch (err) {
      toastError(err.message || "Ko'chirib bo'lmadi");
    }
  }

  const showTestSettings = lessonType === "TEST";

  return (
    <div>
      <button onClick={() => router.push("/teacher/lessons")} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Mavzular ro&apos;yxati
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{topic.title}</h1>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Dars yaratish
        </button>
      </div>

      <div className="space-y-2">
        {topic.lessons.map((lesson, i) => (
          <div key={lesson.id} className="card p-4">
            <div className="flex items-center gap-3">
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
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`badge ${TYPE_BADGE[lesson.type]}`}>{TYPE_LABEL[lesson.type]}</span>
                  {lesson.type === "TEST" && (
                    <>
                      <span>{lesson.questions?.length || 0} savol</span>
                      <span>· o&apos;tish balli {lesson.passScore}%</span>
                      {lesson.timeLimitSec ? <span>· {formatDuration(lesson.timeLimitSec)}</span> : null}
                      {lesson.maxAttempts ? <span>· {lesson.maxAttempts} urinish</span> : null}
                      {lesson.shuffle ? <span>· aralashtiriladi</span> : null}
                    </>
                  )}
                  {lesson.type === "LIVE" && lesson.startsAt && (
                    <span>{new Date(lesson.startsAt).toLocaleString("uz-UZ")}</span>
                  )}
                  {lesson.type === "PUZZLE" && (
                    <>
                      <span>{lesson.puzzleImages?.length || 0} rasm</span>
                      <span>· {lesson.puzzlePoints ? `${lesson.puzzlePoints} ball` : "ballsiz"}</span>
                      <span>· ixtiyoriy</span>
                      <Link
                        href={`/teacher/lessons/${topicId}/puzzle/${lesson.id}`}
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Sinab ko&apos;rish
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <KebabMenu onEdit={() => openEdit(lesson)} onDelete={() => remove(lesson)} />
            </div>

            {lesson.materials?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                {lesson.materials.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800"
                  >
                    <a href={fileUrl(m.fileId)} className="hover:underline">
                      {m.name}
                    </a>
                    <button
                      onClick={() => removeMaterial(lesson.id, m.id)}
                      aria-label="Materialni o'chirish"
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Icon path="M18 6L6 18M6 6l12 12" className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {topic.lessons.length === 0 && <p className="text-sm text-slate-500">Hali dars qo&apos;shilmagan.</p>}
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
              <option value="LIVE">Jonli dars (Zoom / Google Meet)</option>
              <option value="PUZZLE">Pazl (rasmdan yig&apos;iladigan o&apos;yin)</option>
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

          {lessonType === "LIVE" && (
            <div className="space-y-3">
              <div>
                <label className="label">Uchrashuv havolasi (Zoom, Google Meet, Telemost...)</label>
                <input
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="input"
                  placeholder="https://meet.google.com/abc-defg-hij"
                />
              </div>
              <div>
                <label className="label">Boshlanish vaqti</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input" />
                <p className="mt-1 text-xs text-slate-500">
                  Dars yaratilganda barcha talabalarga bildirishnoma yuboriladi.
                </p>
              </div>
              <div>
                <label className="label">Darsga tayyorgarlik / kun tartibi (ixtiyoriy)</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Nimalarni tayyorlab kelish kerak, dars rejasi..."
                  ariaLabel="Jonli dars tavsifi"
                  minHeight={160}
                />
              </div>
            </div>
          )}

          {lessonType === "PUZZLE" && (
            <div className="space-y-3">
              <div>
                <label className="label">Pazl rasmlari</label>
                <PuzzleImagesField
                  existing={puzzleExisting}
                  onRemoveExisting={removePuzzleImage}
                  files={puzzleFiles}
                  onFilesChange={setPuzzleFiles}
                  progress={uploadProgress}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="label">Ball (ixtiyoriy)</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={puzzlePoints}
                  onChange={(e) => setPuzzlePoints(e.target.value)}
                  className="input sm:w-48"
                  placeholder="ball berilmaydi"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Talaba har bir rasmni birinchi marta yig&apos;ganda shuncha ball oladi. Bo&apos;sh qoldirilsa ball
                  berilmaydi. Murakkablik darajasini talaba o&apos;zi tanlaydi; pazl ixtiyoriy — keyingi darsni
                  to&apos;smaydi.
                </p>
              </div>
              <div>
                <label className="label">Topshiriq matni (ixtiyoriy)</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Masalan: rasmni yig'ing va unda nima tasvirlanganini forumda yozing..."
                  ariaLabel="Pazl darsi tavsifi"
                  minHeight={120}
                />
              </div>
            </div>
          )}

          {lessonType === "TEST" && (
            <div>
              <label className="label">
                Test fayli (DOCX, PDF yoki TXT) — <code>~</code> to&apos;g&apos;ri, <code>==</code> noto&apos;g&apos;ri,{" "}
                <code>++++</code> ajratuvchi formatida
              </label>
              <input type="file" accept=".docx,.pdf,.txt" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="input" />
              <p className="mt-1 text-xs text-slate-500">
                Bitta savolda bir nechta <code>~</code> bo&apos;lsa, u ko&apos;p javobli savolga aylanadi.
                {editing && ` Fayl tanlanmasa, mavjud ${editing.questions?.length || 0} savol saqlanadi.`}
              </p>
            </div>
          )}

          {showTestSettings && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-3 text-sm font-semibold">Test sozlamalari</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">O&apos;tish balli (%)</label>
                  <input type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Vaqt (daqiqa)</label>
                  <input type="number" min={1} value={timeLimitMin} onChange={(e) => setTimeLimitMin(e.target.value)} className="input" placeholder="cheksiz" />
                </div>
                <div>
                  <label className="label">Urinishlar</label>
                  <input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="input" placeholder="cheksiz" />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                Savollarni har safar aralashtirish
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Keyingi dars faqat o&apos;tish balli olingandan keyin ochiladi.
              </p>
            </div>
          )}

          <div>
            <label className="label">Darsga biriktiriladigan fayllar (taqdimot, PDF, ish daftari)</label>
            <input type="file" multiple onChange={(e) => setMaterialFiles(e.target.files)} className="input" />
            {editing?.materials?.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Joriy fayllar saqlanadi, yangilari qo&apos;shiladi ({editing.materials.length} ta biriktirilgan).
              </p>
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
