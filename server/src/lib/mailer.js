const { Resend } = require("resend");

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "Mahoratli pedagog <onboarding@resend.dev>";
// Domen hali sotib olinmagani va tasdiqlanmagani sababli haqiqiy yuborish
// vaqtincha o'chirilgan (demo uchun kod ekranda ko'rsatiladi). Domen tayyor
// bo'lgach, .env'da EMAIL_SENDING_ENABLED="true" qilib qo'ying.
const sendingEnabled = process.env.EMAIL_SENDING_ENABLED === "true";

const resend = apiKey ? new Resend(apiKey) : null;

function isConfigured() {
  return !!resend && sendingEnabled;
}

async function sendVerificationEmail(to, code, purpose) {
  if (!resend) return { sent: false };

  const subject =
    purpose === "REGISTER"
      ? "Mahoratli pedagog — ro'yxatdan o'tishni tasdiqlash kodi"
      : "Mahoratli pedagog — parolni tiklash kodi";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Mahoratli pedagog</h2>
      <p>Tasdiqlash kodingiz:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
      <p style="color: #64748b; font-size: 13px;">Kod 10 daqiqa davomida amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.</p>
    </div>
  `;

  const result = await resend.emails.send({ from: fromAddress, to, subject, html });
  if (result.error) {
    throw new Error(result.error.message || "Email yuborishda xatolik");
  }
  return { sent: true };
}

module.exports = { sendVerificationEmail, isConfigured };
