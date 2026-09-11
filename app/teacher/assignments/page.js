"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { assignmentsApi, ApiError } from "@/lib/api";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import RichTextEditor from "@/components/RichTextEditor";
import { useToast } from "@/components/ToastProvider";
import { formatDuration } from "@/lib/formatDuration";
import { isEmptyHtml } from "@/lib/richText";
import { Icon, paths } from "@/components/icons";

export default function TeacherAssignmentsPage() {
  const { success, error: toastError, confirm } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assignmentType, setAssignmentType] = useState("FILE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [dueDate, setDueDate] = useState("");
  const [testFile, setTestFile] = useState(null);
  // Bo'sh qoldirilsa — cheklovsiz (vaqt erkin, urinishlar cheksiz).
  const [timeLimitMin, setTimeLimitMin] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function reload() {
    return assignmentsApi.list().then(({ assignments }) => setAssignments(assignments));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    let list = assignments.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") {
      list = list.filter((a) => {
        const closed = new Date(a.dueDate) < new Date();
        return statusFilter === "closed" ? closed : !closed;
      });
    }
    return list;
  }, [assignments, search, statusFilter]);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  function openCreate() {
    setEditing(null);
    setAssignmentType("FILE");
    setTitle("");
    setDescription("");
    setMaxScore(100);
    setDueDate("");
    setTestFile(null);
    setTimeLimitMin("");
    setMaxAttempts("");
    setFormError("");
    setOpen(true);
  }
  function openEdit(a) {
    setEditing(a);
    setAssignmentType(a.type);
    setTitle(a.title);
    setDescription(a.description);
    setMaxScore(a.maxScore);
    setDueDate(a.dueDate?.slice(0, 16) || "");
    setTestFile(null);
    setTimeLimitMin(a.timeLimitSec ? Math.round(a.timeLimitSec / 60) : "");
    setMaxAttempts(a.maxAttempts || "");
    setFormError("");
    setOpen(true);
  }
  async function save(e) {
    e.preventDefault();
    if (assignmentType === "FILE" && isEmptyHtml(description) && !editing?.materials?.length) {
      setFormError("Tavsif yoki materiallardan kamida bittasi to'ldirilishi shart");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title,
        description,
        type: assignmentType,
        maxScore,
        dueDate,
        // Bo'sh maydon null bo'lib ketadi — server buni "cheklovsiz" deb tushunadi.
        timeLimitSec: assignmentType === "TEST" && timeLimitMin ? Number(timeLimitMin) * 60 : null,
        maxAttempts: assignmentType === "TEST" && maxAttempts ? Number(maxAttempts) : null,
      };
      let assignmentId = editing?.id;
      if (editing) await assignmentsApi.update(editing.id, payload);
      else assignmentId = (await assignmentsApi.create({ ...payload, steps: [] })).assignment.id;

      if (assignmentType === "TEST" && testFile) {
        const formData = new FormData();
        formData.append("file", testFile);
        await assignmentsApi.importTest(assignmentId, formData);
      }
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }
  async function remove(assignment) {
    const ok = await confirm({
      title: "Vazifa o'chirilsinmi?",
      description: `${assignment.title} — yuborilgan javoblar ham o'chadi.`,
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await assignmentsApi.remove(assignment.id);
      await reload();
      success("Vazifa o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vazifalar</h1>
        <div className="flex flex-wrap gap-2">
        <a href={assignmentsApi.exportUrl()} download className="btn-secondary">
          <Icon path={paths.download} className="h-4 w-4" /> Baholar (CSV)
        </a>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Vazifa yaratish
        </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className="input pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">Barchasi</option>
          <option value="open">Ochiq</option>
          <option value="closed">Yopilgan</option>
        </select>
      </div>

      <div className="space-y-2">
        {rows.map((a) => {
          const closed = new Date(a.dueDate) < new Date();
          const notReviewed = a.submissions.filter((s) => s.status === "NOT_REVIEWED").length;
          return (
            <div key={a.id} className="card flex items-center gap-3 p-4">
              <Link href={`/teacher/assignments/${a.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.type === "TEST" ? `Test · ${a.questions?.length || 0} savol` : "Fayl"}
                  {a.type === "TEST" && a.timeLimitSec ? ` · ${formatDuration(a.timeLimitSec)}` : ""}
                  {a.type === "TEST" && a.maxAttempts ? ` · ${a.maxAttempts} urinish` : ""} · Max: {a.maxScore} ·{" "}
                  {a.submissions.length} javob{notReviewed > 0 && ` · ${notReviewed} tekshirilmagan`}
                </p>
              </Link>
              <span className={`badge shrink-0 ${closed ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"}`}>
                {closed ? "Yopilgan" : "Ochiq"}
              </span>
              <KebabMenu onEdit={() => openEdit(a)} onDelete={() => remove(a)} />
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Vazifani tahrirlash" : "Vazifa yaratish"} wide>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Turi</label>
            <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} className="input" disabled={!!editing}>
              <option value="FILE">Fayl topshirish (qo'lda baholanadi)</option>
              <option value="TEST">Test (avtomatik baholanadi)</option>
            </select>
          </div>
          <div>
            <label className="label">Tavsif{assignmentType === "TEST" && " (ixtiyoriy)"}</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Vazifa sharti, bajarish tartibi, baholash mezonlari..."
              ariaLabel="Vazifa tavsifi"
              minHeight={200}
            />
          </div>

          {assignmentType === "TEST" && (
            <div>
              <label className="label">
                Test fayli (DOCX, PDF yoki TXT) — <code>~</code> to'g'ri, <code>==</code> noto'g'ri, <code>++++</code> ajratuvchi formatida
              </label>
              <input type="file" accept=".docx,.pdf,.txt" onChange={(e) => setTestFile(e.target.files?.[0] || null)} className="input" />
              <p className="mt-1 text-xs text-slate-500">
                Faylda bir nechta savol bo'lishi mumkin — talaba ularning barchasiga javob beradi, umumiy natijaga qarab ball avtomatik
                hisoblanadi. Bitta savolda bir nechta <code>~</code> belgilansa, u ko'p javobli savolga aylanadi (talabada checkbox
                chiziladi va faqat barcha to'g'ri javoblar tanlangandagina hisobga olinadi).
                {editing && ` Fayl tanlanmasa, mavjud ${editing.questions?.length || 0} savol saqlanadi.`}
              </p>
            </div>
          )}

          {assignmentType === "TEST" && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-3 text-sm font-semibold">Test sozlamalari</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Vaqt (daqiqa)</label>
                  <input
                    type="number"
                    min={1}
                    value={timeLimitMin}
                    onChange={(e) => setTimeLimitMin(e.target.value)}
                    className="input"
                    placeholder="cheklanmagan"
                  />
                </div>
                <div>
                  <label className="label">Urinishlar soni</label>
                  <input
                    type="number"
                    min={1}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="input"
                    placeholder="cheksiz"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Maydonlar bo&apos;sh qoldirilsa cheklov qo&apos;yilmaydi: talaba testni erkin, xohlagancha vaqt sarflab
                va cheksiz marta ishlay oladi. Vaqt belgilansa, u tugaganda javoblar avtomatik yuboriladi.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Maksimal baho</label>
              <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Muddat</label>
              <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" required />
            </div>
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
