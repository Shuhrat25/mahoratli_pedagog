/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Frontend (Vercel) va backend (Render) turli domenlarda joylashgani uchun
  // auth cookie "third-party cookie" hisoblanadi va ko'p brauzerlar (Safari
  // doim, Chrome ko'pincha) uni bloklaydi — natijada kirish ishlagandek
  // ko'rinadi, lekin sessiya saqlanmaydi. Yechim: /api so'rovlarini shu
  // domenning o'zi orqali (server tomondan) backendga proksi qilish, shunda
  // brauzer uchun bu doim "birinchi tomon" (first-party) bo'lib qoladi.
  async rewrites() {
    const backend = process.env.BACKEND_URL;
    if (!backend) return [];
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

module.exports = nextConfig;
