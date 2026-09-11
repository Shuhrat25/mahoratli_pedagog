"use client";

// Parol talablari — server/src/lib/constants.js dagi validatePassword bilan
// bir xil qoidalar. Bu yerdagisi shunchaki foydalanuvchiga tez javob berish
// uchun; haqiqiy tekshiruv har doim serverda bo'ladi.

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Parolda kamida bitta harf va bitta raqam bo'lishi kerak";
  }
  return null;
}

/** 0..4 — parol kuchi (ko'rsatkich chizig'i uchun). */
export function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(4, score);
}

const LABELS = ["juda zaif", "zaif", "o'rtacha", "yaxshi", "kuchli"];
const COLORS = ["bg-rose-500", "bg-rose-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];

export function PasswordStrength({ password }) {
  if (!password) return null;
  const score = passwordStrength(password);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? COLORS[score] : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Parol kuchi: {LABELS[score]} · kamida {MIN_PASSWORD_LENGTH} ta belgi, harf va raqam
      </p>
    </div>
  );
}
