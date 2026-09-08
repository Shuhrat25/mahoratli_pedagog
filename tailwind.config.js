/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  // Banner gradient klasslari backenddan (ma'lumotlar bazasidan) runtime'da
  // keladi, shuning uchun Tailwind ularni manba kodini skanerlab topa olmaydi —
  // aks holda banner foni chizilmay, oq matn ko'rinmay qolardi. Ro'yxat
  // server/src/routes/banners.js dagi GRADIENTS bilan bir xil bo'lishi kerak.
  safelist: [
    "from-brand-600", "to-sky-700",
    "from-sky-600", "to-cyan-700",
    "from-cyan-600", "to-blue-700",
    "from-blue-600", "to-indigo-700",
    "from-indigo-600", "to-violet-700",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
