"use client";

import { useEffect, useState } from "react";
import { materialsApi, fileUrl } from "@/lib/api";
import { Icon, paths } from "@/components/icons";

export default function StudentMaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    materialsApi.list().then(({ materials }) => setMaterials(materials)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold">Materiallar</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {materials.map((m) => (
          <a
            key={m.id}
            href={fileUrl(m.fileId)}
            className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
              <Icon path={paths.materials} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.title}</p>
              <p className="text-xs text-slate-500">
                {m.type} · {m.size} · {new Date(m.uploadedAt).toLocaleDateString("uz-UZ")}
              </p>
            </div>
            <Icon path={paths.download} className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          </a>
        ))}
      </div>
    </div>
  );
}
