"use client";

import { useState } from "react";
import { useApp } from "@/lib/auth-context";
import UniversityAutocomplete from "@/components/UniversityAutocomplete";

export default function StudentProfilePage() {
  const { currentUser, updateMe } = useApp();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [university, setUniversity] = useState(currentUser?.university || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [saved, setSaved] = useState(false);

  if (!currentUser) return null;

  async function handleSave(e) {
    e.preventDefault();
    await updateMe({ firstName, lastName, university, email });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">Profil</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
            {currentUser.firstName.charAt(0)}
          </div>
          <div>
            <p className="font-bold">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="text-sm text-slate-500">@{currentUser.login}</p>
          </div>
        </div>

        {!editing ? (
          <div className="space-y-2 text-sm">
            <Row label="Elektron pochta" value={currentUser.email} />
            <Row label="Universitet" value={currentUser.university || "—"} />
            <Row label="Ball" value={currentUser.points ?? 0} />
            <Row label="Ro'yxatdan o'tgan sana" value={new Date(currentUser.createdAt).toLocaleDateString("uz-UZ")} />
            <button
              onClick={() => setEditing(true)}
              className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Tahrirlash
            </button>
            {saved && <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">Saqlandi!</p>}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ism</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Familiya</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" required />
              </div>
            </div>
            <div>
              <label className="label">Universitet</label>
              <UniversityAutocomplete
                value={university}
                onChange={setUniversity}
                placeholder="Nomi yoki qisqartmasini yozing (masalan: TDTU)"
              />
            </div>
            <div>
              <label className="label">Elektron pochta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Saqlash
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Bekor qilish
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
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
