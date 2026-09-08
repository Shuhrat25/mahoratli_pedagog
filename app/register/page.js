"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/auth-context";
import { UNIVERSITIES } from "@/lib/mockData";
import { authApi, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register, isLoginTaken } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [university, setUniversity] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [email, setEmail] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");

  const [login, setLoginValue] = useState("");
  const [loginTaken, setLoginTaken] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!login) {
      setLoginTaken(false);
      return;
    }
    let cancelled = false;
    isLoginTaken(login).then((taken) => {
      if (!cancelled) setLoginTaken(taken);
    });
    return () => {
      cancelled = true;
    };
  }, [login, isLoginTaken]);

  function handleStep1Submit(e) {
    e.preventDefault();
    if (password !== password2) {
      setFormError("Parollar mos kelmadi");
      return;
    }
    setFormError("");
    setStep(2);
  }

  async function requestCode(e) {
    e.preventDefault();
    setFormError("");
    try {
      const res = await authApi.sendCode(email, "REGISTER");
      setDevCode(res.devCode || "");
      setCodeRequested(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function confirmCode(e) {
    e.preventDefault();
    try {
      const res = await authApi.verifyCode(email, code, "REGISTER");
      setCodeError("");
      setEmailVerified(true);
      setVerifiedToken(res.verifiedToken);
      setStep(3);
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function handleFinish(e) {
    e.preventDefault();
    if (!login.trim() || loginTaken) return;
    setSubmitting(true);
    const result = await register({ firstName, lastName, university, password, email, login, verifiedToken });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="card w-full max-w-md p-6">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700 dark:text-brand-400">
          Mahoratli pedagog
        </Link>
        <h1 className="mb-1 text-center text-xl font-semibold">Ro'yxatdan o'tish</h1>
        <StepIndicator step={step} />

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="mt-5 space-y-4">
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
              <label className="label">Universitet / institut (ixtiyoriy)</label>
              <select value={university} onChange={(e) => setUniversity(e.target.value)} className="input">
                <option value="">Tanlanmagan</option>
                {UNIVERSITIES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Parol</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="label">Parolni takrorlang</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="input"
                required
                minLength={6}
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button type="submit" className="btn-primary w-full">
              Davom etish
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="mt-5 space-y-4">
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <label className="label">Elektron pochta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCodeRequested(false);
                    setEmailVerified(false);
                  }}
                  className="input"
                  required
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              {!codeRequested && (
                <button type="submit" className="btn-primary w-full" disabled={!email}>
                  Tasdiqlash
                </button>
              )}
            </form>

            {codeRequested && !emailVerified && (
              <form onSubmit={confirmCode} className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
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
                {codeError && <p className="text-sm text-red-600">{codeError}</p>}
                <button type="submit" className="btn-primary w-full">
                  Kodni tasdiqlash
                </button>
              </form>
            )}

            <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:underline">
              ← Orqaga
            </button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleFinish} className="mt-5 space-y-4">
            <div>
              <label className="label">Login o'ylab toping</label>
              <input
                value={login}
                onChange={(e) => setLoginValue(e.target.value.trim())}
                className="input"
                required
              />
              {loginTaken && (
                <p className="mt-1 text-xs text-red-600">Bunday login mavjud, iltimos boshqa o'ylab toping</p>
              )}
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loginTaken || submitting}>
              Ro'yxatdan o'tishni yakunlash
            </button>
            <button type="button" onClick={() => setStep(2)} className="w-full text-sm text-slate-500 hover:underline">
              ← Orqaga
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Hisobingiz bormi?{" "}
          <Link href="/login" className="text-brand-700 hover:underline dark:text-brand-400">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              s <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"
            }`}
          >
            {s}
          </div>
          {s < 3 && <div className={`h-0.5 w-8 ${s < step ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}
