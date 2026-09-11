"use client";

import { useState } from "react";
import { validatePassword, PasswordStrength } from "@/lib/passwordRules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState("email");
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  async function submitEmail(e) {
    e.preventDefault();
    try {
      const res = await authApi.sendCode(email, "RESET");
      setDevCode(res.devCode || "");
      setError("");
      setStage("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    try {
      const res = await authApi.verifyCode(email, code, "RESET");
      setVerifiedToken(res.verifiedToken);
      setError("");
      setStage("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== password2) {
      setError("Parollar mos kelmadi");
      return;
    }
    try {
      await authApi.resetPassword({ email, newPassword: password, verifiedToken });
      setError("");
      setStage("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="card w-full max-w-sm p-6">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700 dark:text-brand-400">
          Mahoratli pedagog
        </Link>
        <h1 className="mb-4 text-center text-xl font-semibold">Parolni tiklash</h1>

        {stage === "email" && (
          <form onSubmit={submitEmail} className="space-y-4">
            <div>
              <label className="label">Ro'yxatdan o'tgan pochta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full">
              Kod yuborish
            </button>
          </form>
        )}

        {stage === "code" && (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-sm text-slate-500">
              {email} manziliga 6 xonali kod yuborildi.
              {devCode && ` (Demo kod: ${devCode})`}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input tracking-widest"
              maxLength={6}
              placeholder="______"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full">
              Tasdiqlash
            </button>
          </form>
        )}

        {stage === "reset" && (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label className="label">Yangi parol</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required minLength={8} />
              <PasswordStrength password={password} />
            </div>
            <div>
              <label className="label">Yangi parolni takrorlang</label>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} className="input" required minLength={6} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full">
              Parolni saqlash
            </button>
          </form>
        )}

        {stage === "done" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">Parolingiz muvaffaqiyatli yangilandi.</p>
            <button onClick={() => router.push("/login")} className="btn-primary w-full">
              Kirish sahifasiga o'tish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
