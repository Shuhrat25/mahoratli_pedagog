const { WebSocketServer } = require("ws");
const { verifyToken, COOKIE_NAME } = require("./lib/jwt");
const { markOnline, markOffline } = require("./lib/presence");

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

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const token = extractToken(req);
    let userId = null;

    try {
      const payload = verifyToken(token);
      userId = payload.sub;
      markOnline(userId);
      ws.send(JSON.stringify({ type: "connected" }));
    } catch {
      ws.close(4001, "Yaroqsiz token");
      return;
    }

    ws.on("close", () => {
      if (userId) markOffline(userId);
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer };
