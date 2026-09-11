"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/auth-context";
import { usersApi, ApiError } from "@/lib/api";
import ParticipantModal from "@/components/ParticipantModal";
import Modal from "@/components/Modal";
import KebabMenu from "@/components/KebabMenu";
import { useToast } from "@/components/ToastProvider";
import { Icon, paths } from "@/components/icons";

const ROLE_LABEL = { TEACHER: "O'qituvchi", ADMIN: "Admin", STUDENT: "O'quvchi" };

export default function ParticipantsPage() {
  const { currentUser } = useApp();
  const { success, error: toastError, confirm } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("firstName");
  const [sortDir, setSortDir] = useState("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [formError, setFormError] = useState("");

  const isMainTeacher = currentUser?.role === "TEACHER";

  function reload() {
    return usersApi.list().then(({ users }) => setUsers(users));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    let list = users.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email} ${u.university || ""}`.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [users, search, sortKey, sortDir]);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openCreate() {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditing(user);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(form) {
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await usersApi.update(editing.id, payload);
      } else {
        await usersApi.create(form);
      }
      await reload();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function handleDelete(user) {
    if (user.role === "TEACHER" && !isMainTeacher) return;
    const ok = await confirm({
      title: "Ishtirokchi o'chirilsinmi?",
      description: `${user.firstName} ${user.lastName} — barcha javoblari va natijalari ham o'chadi.`,
      confirmLabel: "O'chirish",
    });
    if (!ok) return;
    try {
      await usersApi.remove(user.id);
      await reload();
      success("Ishtirokchi o'chirildi");
    } catch (err) {
      toastError(err.message || "O'chirib bo'lmadi");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Ishtirokchilar</h1>
        <button onClick={openCreate} className="btn-primary">
          <Icon path={paths.plus} className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className="input pl-9" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <SortableHeader label="To'liq ism" sortKey="firstName" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Universitet" sortKey="university" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Pochta" sortKey="email" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Rol" sortKey="role" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3">Holat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                onClick={() => setViewing(u)}
              >
                <td className="px-4 py-3 font-medium">
                  {u.firstName} {u.lastName}
                </td>
                <td className="px-4 py-3 text-slate-500">{u.university || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.isOnline ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                    {u.isOnline ? "Onlayn" : "Oflayn"}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {(u.role !== "TEACHER" || isMainTeacher) && (
                    <KebabMenu onEdit={() => openEdit(u)} onDelete={() => handleDelete(u)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ParticipantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
        allowTeacherRole={isMainTeacher}
        error={formError}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Ishtirokchi ma'lumotlari">
        {viewing && (
          <div className="space-y-2 text-sm">
            <Row label="Ism familiya" value={`${viewing.firstName} ${viewing.lastName}`} />
            <Row label="Login" value={viewing.login} />
            <Row label="Universitet" value={viewing.university || "—"} />
            <Row label="Pochta" value={viewing.email} />
            <Row label="Rol" value={ROLE_LABEL[viewing.role]} />
            <Row label="Ro'yxatdan o'tgan sana" value={new Date(viewing.createdAt).toLocaleDateString("uz-UZ")} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function SortableHeader({ label, sortKey, activeKey, dir, onClick }) {
  const active = sortKey === activeKey;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 ${active ? "text-slate-700 dark:text-slate-200" : ""}`}
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`h-3 w-3 shrink-0 transition-transform ${active ? "opacity-100" : "opacity-30"} ${
            active && dir === "desc" ? "rotate-180" : ""
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
        </svg>
      </button>
    </th>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
