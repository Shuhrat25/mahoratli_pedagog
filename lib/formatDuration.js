"use client";

/**
 * Soniyalarni o'qiladigan ko'rinishga keltiradi.
 *
 * `Math.round(sec / 60)` ishlatilganda 30 soniya "1 daqiqa" bo'lib, 90 soniya
 * "2 daqiqa" bo'lib chiqardi — ya'ni noto'g'ri ma'lumot ko'rsatilardi.
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} soniya`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!rest) return `${minutes} daqiqa`;
  return `${minutes} daq ${rest} son`;
}

/** Sanoq uchun qisqa ko'rinish: 05:42 */
export function formatClock(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
