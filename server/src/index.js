require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const { attachUser } = require("./middleware/auth");
const { attachWebSocketServer } = require("./ws");
const { startReminders } = require("./lib/reminders");
const { toHttpError } = require("./lib/httpError");
const { MAX_STUDENT_UPLOAD_BYTES } = require("./lib/constants");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const bannerRoutes = require("./routes/banners");
const postRoutes = require("./routes/posts");
const pollRoutes = require("./routes/polls");
const topicRoutes = require("./routes/topics");
const assignmentRoutes = require("./routes/assignments");
const materialRoutes = require("./routes/materials");
const forumRoutes = require("./routes/forum");
const fileRoutes = require("./routes/files");
const notificationRoutes = require("./routes/notifications");

const app = express();

// Render/Vercel proksisi ortida haqiqiy mijoz IP'sini olish uchun — rate
// limiter aynan shu IP bo'yicha hisoblaydi.
app.set("trust proxy", 1);

// CLIENT_ORIGIN bir nechta manzilni vergul bilan ajratib qabul qiladi —
// masalan lokal frontend (http://localhost:3000) va productiondagi Vercel
// domeni bir vaqtda ishlashi uchun.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const err = new Error(`CORS: ${origin} ruxsat etilmagan (CLIENT_ORIGIN ro'yxatida yo'q)`);
      err.isCorsRejection = true;
      callback(err);
    },
    credentials: true,
  })
);
// Rich-text tahrirlagich uzun HTML yuborishi mumkin (dars matni, vazifa
// tavsifi), shuning uchun express'ning standart 100kb chegarasi oshirilgan.
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(attachUser);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => res.status(404).json({ error: "Topilmadi" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.isCorsRejection) {
    return res.status(403).json({ error: err.message });
  }

  // Prisma xatolari (topilmadi / band / bog'liqlik) tushunarli statusga
  // aylanadi — ilgari ularning hammasi 500 "Server xatosi" bo'lardi.
  const mapped = toHttpError(err);
  if (mapped) return res.status(mapped.status).json({ error: mapped.message });

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(MAX_STUDENT_UPLOAD_BYTES / (1024 * 1024));
      return res.status(413).json({ error: `Fayl juda katta — eng ko'pi bilan ${mb} MB` });
    }
    if (err.code === "LIMIT_FIELD_VALUE") {
      return res.status(413).json({ error: "Matn juda uzun" });
    }
    // fileFilter'dan kelgan xabar (ruxsat etilmagan fayl turi) shu yerda.
    return res.status(400).json({ error: `Fayl yuklashda xato: ${err.message}` });
  }

  console.error(err);
  res.status(500).json({ error: "Server xatosi" });
});

const server = http.createServer(app);
attachWebSocketServer(server);
startReminders();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Mahoratli pedagog API http://localhost:${PORT} portida ishga tushdi`);
});
