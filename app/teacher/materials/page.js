"use client";

import { useEffect, useMemo, useState } from "react";
import { materialsApi } from "@/lib/api";
import KebabMenu from "@/components/KebabMenu";
import Modal from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { Icon, paths } from "@/components/icons";

export default function TeacherMaterialsPage() {
  const { success, error: toastError, confirm } = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [titleValue, setTitleValue] = useState("");
  const [uploading, setUploading] = useState(false);

  function reload() {
    return materialsApi.list().then(({ materials }) => setMaterials(materials));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const rows = useMemo(
    () => materials.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())),
    [materials, search]
  );

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    try {
      const { materials: added } = await materialsApi.upload(formData);
      await reload();
      success(`${added.length} ta fayl yuklandi`);
    } catch (err) {
      toastError(err.message || "Yuklab bo'lmadi");
    } finally {
      setUploading(false);
    }
  }

  async function remove(material) {
    const ok = await confirm({
      title: "Material o'chirilsinmi?",
      description: material.title,
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await materialsApi.remove(material.id);
      await reload();
      success("Material o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  function openEdit(m) {
    setEditing(m);
    setTitleValue(m.title);
  }
  async function saveEdit(e) {
    e.preventDefault();
    await materialsApi.update(editing.id, titleValue);
    await reload();
    setEditing(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Materiallar</h1>
        <label className="btn-primary cursor-pointer">
          <Icon path={paths.upload} className="h-4 w-4" /> {uploading ? "Yuklanmoqda..." : "Qo'shish"}
          <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={uploading} />
        </label>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className="input pl-9" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              <Icon path={paths.materials} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.title}</p>
              <p className="text-xs text-slate-500">
                {m.type} · {m.size} · {new Date(m.uploadedAt).toLocaleDateString("uz-UZ")}
              </p>
            </div>
            <KebabMenu onEdit={() => openEdit(m)} onDelete={() => remove(m)} />
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Materialni tahrirlash">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Nomi</label>
            <input value={titleValue} onChange={(e) => setTitleValue(e.target.value)} className="input" required />
          </div>
          <button type="submit" className="btn-primary w-full">
            Saqlash
          </button>
        </form>
      </Modal>
    </div>
  );
}
