"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useApp();
  const router = useRouter();
  const [loginOrEmail, setLoginOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await login(loginOrEmail, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.user.role === "STUDENT" ? "/student" : "/teacher");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="card w-full max-w-sm p-6">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700 dark:text-brand-400">
          Mahoratli pedagog
        </Link>
        <h1 className="mb-4 text-center text-xl font-semibold">Tizimga kirish</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Login yoki elektron pochta</label>
            <input
              value={loginOrEmail}
              onChange={(e) => setLoginOrEmail(e.target.value)}
              className="input"
              placeholder="login yoki email"
              required
            />
          </div>
          <div>
            <label className="label">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Kirish
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-700 hover:underline dark:text-brand-400">
            Parolni unutdingizmi?
          </Link>
          <Link href="/register" className="text-brand-700 hover:underline dark:text-brand-400">
            Ro'yxatdan o'tish
          </Link>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">
          <p className="font-medium">Demo hisoblar:</p>
          <p>O'qituvchi: teacher / teacher123</p>
          <p>Talaba: student / student123</p>
        </div>
      </div>
    </div>
  );
}
