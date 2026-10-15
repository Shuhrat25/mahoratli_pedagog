const prisma = require("./db");
const { WebSocketServer } = require("ws");
const { verifyToken, COOKIE_NAME } = require("./lib/jwt");
const { markOnline, markOffline, touch } = require("./lib/presence");

// httpOnly cookie bo'lgani uchun frontend uni JS orqali o'qiy olmaydi —
// token WS handshake so'rovidagi Cookie headeridan olinadi (bir xil sayt
// bo'lgani uchun brauzer uni avtomatik yuboradi), query param esa fallback.
function extractToken(req) {
  const url = new URL(req.url, "http://localhost");
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// userId -> ochiq socketlar to'plami. Bildirishnomalarni darhol yetkazish uchun.
const sockets = new Map();

function addSocket(userId, ws) {
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(ws);
}

function removeSocket(userId, ws) {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(userId);
}

/** Bitta foydalanuvchining barcha ochiq tablariga xabar yuboradi. */
function sendToUser(userId, payload) {
  const set = sockets.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  set.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* yopilib qolgan ulanish — e'tiborsiz */
      }
    }
  });
}

const HEARTBEAT_MS = 30 * 1000;

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 1024 });

  wss.on("connection", async (ws, req) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    // CSWSH himoyasi: faqat ruxsat etilgan Origin qabul qilinadi
    if (origin && !allowedOrigins.includes(origin)) {
      ws.close(4003, "Ruxsat etilmagan Origin");
      return;
    }

    const token = extractToken(req);
    let userId = null;

    try {
      const payload = verifyToken(token);
      userId = payload.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.tokenVersion !== payload.tv) {
        ws.close(4001, "Yaroqsiz token");
        return;
      }
    } catch {
      ws.close(4001, "Yaroqsiz token");
      return;
    }

    ws.sessionToken = token;
    ws.userId = userId;
    ws.isAlive = true;
    markOnline(userId);
    addSocket(userId, ws);
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("pong", () => {
      ws.isAlive = true;
      touch(userId);
    });

    // Frontend ham vaqti-vaqti bilan "ping" yuboradi (brauzerdagi WebSocket
    // API'da protokol darajasidagi ping yo'q) — bu ham tiriklik belgisi.
    ws.on("message", () => {
      ws.isAlive = true;
      touch(userId);
    });

    ws.on("close", () => {
      removeSocket(userId, ws);
      markOffline(userId);
    });

    ws.on("error", () => {
      // 'close' baribir chaqiriladi — bu yerda faqat jarayonni yiqitmaslik uchun.
    });
  });

  // Proksi ortida uzilib qolgan ulanishlar "close" hodisasini yubormasligi
  // mumkin — shuning uchun javob bermayotganlarini o'zimiz uzamiz, aks holda
  // ular abadiy "onlayn" bo'lib qolardi.
  const heartbeat = setInterval(() => {
    wss.clients.forEach(async (ws) => {
      if (ws.sessionToken) {
        try {
          const payload = verifyToken(ws.sessionToken);
          const user = await prisma.user.findUnique({ where: { id: ws.userId }, select: { tokenVersion: true } });
          if (!user || user.tokenVersion !== payload.tv) return ws.close(4001, "Session revoked");
        } catch { return ws.close(4001, "Session expired"); }
      }
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    });
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

function disconnectUser(userId) {
  const set = sockets.get(userId);
  if (set) for (const ws of set) ws.close(4001, "Session revoked");
}
module.exports = { attachWebSocketServer, sendToUser, disconnectUser };
