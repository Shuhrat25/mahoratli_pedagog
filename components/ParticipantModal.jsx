"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import UniversityAutocomplete from "@/components/UniversityAutocomplete";

const emptyForm = { firstName: "", lastName: "", email: "", login: "", university: "", role: "STUDENT", password: "" };

export default function ParticipantModal({ open, onClose, onSave, initial, allowTeacherRole, error }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (initial) {
      setForm({ ...emptyForm, ...initial, password: "" });
    } else {
      setForm(emptyForm);
    }
  }, [initial, open]);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Ishtirokchini tahrirlash" : "Ishtirokchi qo'shish"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ism</label>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Familiya</label>
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required />
          </div>
        </div>
        <div>
          <label className="label">Universitet</label>
          <UniversityAutocomplete
            value={form.university}
            onChange={(v) => setForm({ ...form, university: v })}
            placeholder="Nomi yoki qisqartmasini yozing (masalan: TDTU)"
          />
        </div>
        <div>
          <label className="label">Elektron pochta</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required />
        </div>
        <div>
          <label className="label">Login</label>
          <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className="input" required />
        </div>
        <div>
          <label className="label">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
            <option value="STUDENT">O'quvchi</option>
            <option value="ADMIN">Admin</option>
            {allowTeacherRole && <option value="TEACHER">O'qituvchi</option>}
          </select>
        </div>
        <div>
          <label className="label">{initial ? "Yangi parol (ixtiyoriy)" : "Parol"}</label>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
            required={!initial}
            placeholder={initial ? "O'zgartirmaslik uchun bo'sh qoldiring" : ""}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full">
          Saqlash
        </button>
      </form>
    </Modal>
  );
}
