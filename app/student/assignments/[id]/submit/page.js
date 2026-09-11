"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { assignmentsApi, fileUrl } from "@/lib/api";
import RichText from "@/components/RichText";
import { useToast } from "@/components/ToastProvider";
import { Icon, paths } from "@/components/icons";

// Talabaning ishni topshirish sahifasi.
//
// Nima uchun alohida sahifa: fayl hajmi 10MB bilan chegaralangan, shuning
// uchun katta ishni bir nechta faylga bo'lib yuborish kerak bo'ladi. Kichik
// "fayl tanlash" tugmasi bunga to'g'ri kelmasdi — endi bu yerda fayllar
// ro'yxatini yig'ish, keraksizini olib tashlash va izoh qo'shish mumkin.

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitAssignmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [assignment, setAssignment] = useState(null);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    assignmentsApi
      .get(id)
      .then(({ assignment }) => {
        setAssignment(assignment);
        setText(assignment.submissions[0]?.text || "");
      })
      .catch(() => setAssignment(null));
  }, [id]);

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  if (!assignment) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const closed = new Date(assignment.dueDate) < new Date();
  const mySubmission = assignment.submissions[0];

  function addFiles(incoming) {
    const rejected = [];
    const accepted = [];

    Array.from(incoming).forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} — ${formatSize(file.size)}, chegara 10 MB`);
        return;
      }
      // Bir xil fayl ikki marta qo'shilib qolmasin.
      const duplicate = files.some((f) => f.name === file.name && f.size === file.size);
      if (duplicate) return;
      accepted.push(file);
    });

    const room = MAX_FILES - files.length;
    if (accepted.length > room) {
      rejected.push(`Eng ko'pi bilan ${MAX_FILES} ta fayl yuborish mumkin`);
    }

    setFiles((prev) => [...prev, ...accepted.slice(0, Math.max(0, room))]);
    setErrors(rejected);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;
    if (files.length === 0) {
      setErrors(["Kamida bitta fayl tanlang"]);
      return;
    }

    setSending(true);
    setErrors([]);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      if (text.trim()) formData.append("text", text.trim());
      await assignmentsApi.submit(id, formData);
      success("Ish yuborildi");
      router.push(`/student/assignments/${id}`);
    } catch (err) {
      toastError(err.message || "Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => router.push(`/student/assignments/${id}`)}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
      >
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Vazifaga qaytish
      </button>

      <h1 className="text-2xl font-extrabold">Ishni topshirish</h1>
      <p className="mt-1 text-sm text-slate-500">
        {assignment.title} · Muddat: {new Date(assignment.dueDate).toLocaleString("uz-UZ")}
      </p>

      {closed ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium">Vazifa muddati tugagan — ishni yuborib bo&apos;lmaydi.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {mySubmission?.files?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-bold">Oldin yuborilgan fayllar</h2>
              <ul className="space-y-1">
                {mySubmission.files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={fileUrl(f.fileId)}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <Icon path={paths.download} className="h-4 w-4" /> {f.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Yangi fayllar yuborilsa, oldingilari almashtiriladi.
              </p>
            </div>
          )}

          {/* Fayllarni tanlash / sudrab tashlash */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
            }`}
          >
            <Icon path={paths.upload} className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium">Fayllarni shu yerga tashlang</p>
            <p className="mt-0.5 text-xs text-slate-500">
              yoki tanlang — har bir fayl 10 MB gacha, {MAX_FILES} tagacha fayl
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Fayl tanlash
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold">Tanlangan fayllar ({files.length})</span>
                <span className="text-slate-500">{formatSize(totalSize)}</span>
              </div>
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${i}`}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                  >
                    <Icon path={paths.materials} className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`${f.name} — ro'yxatdan olib tashlash`}
                      className="shrink-0 text-slate-400 hover:text-rose-600"
                    >
                      <Icon path="M18 6L6 18M6 6l12 12" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="label" htmlFor="submission-text">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              id="submission-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="input"
              placeholder="Ish haqida qisqacha: nimani qildingiz, qaysi fayl nimaga tegishli..."
            />
          </div>

          {errors.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={sending || files.length === 0}
              className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? "Yuborilmoqda..." : "Yuborish"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/student/assignments/${id}`)}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {assignment.description && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-bold">Vazifa sharti</h2>
          <RichText value={assignment.description} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300" />
        </div>
      )}
    </div>
  );
}
