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
    "from-brand-600", "to-emerald-700",
    "from-emerald-600", "to-teal-700",
    "from-teal-600", "to-cyan-700",
    "from-sky-600", "to-indigo-700",
    "from-indigo-600", "to-purple-700",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf6",
          100: "#dcfce9",
          200: "#bbf7d3",
          300: "#86efb0",
          400: "#4ade85",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
