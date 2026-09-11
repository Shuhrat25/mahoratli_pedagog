"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, usersApi, notificationsApi, ApiError, wsUrl } from "./api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => setCurrentUser(null))
      .finally(() => setReady(true));
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const { notifications: items, unread: count } = await notificationsApi.list();
      setNotifications(items);
      setUnread(count);
    } catch {
      // Bildirishnomalar ikkinchi darajali — xato bo'lsa jim o'tkazamiz.
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    loadNotifications();
  }, [currentUser?.id, loadNotifications]);

  // Onlayn holat va jonli bildirishnomalar uchun WS ulanishi.
  useEffect(() => {
    if (!currentUser) return;

    let closed = false;
    let keepAlive;
    let reconnectTimer;

    function connect() {
      if (closed) return;
      let ws;
      try {
        ws = new WebSocket(wsUrl());
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        // Server ping/pong yuboradi, lekin brauzer WebSocket API'sida unga
        // javob berish ko'rinmaydi — qo'shimcha "tiriklik" signali sifatida
        // o'zimiz ham vaqti-vaqti bilan xabar yuboramiz.
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "notification") {
          setNotifications((prev) => [payload.notification, ...prev].slice(0, 30));
          setUnread((n) => n + 1);
        } else if (payload.type === "notifications-changed") {
          loadNotifications();
        }
      };

      ws.onclose = () => {
        clearInterval(keepAlive);
        if (!closed) reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* e'tiborsiz */
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearInterval(keepAlive);
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [currentUser?.id, loadNotifications]);

  const login = useCallback(async (loginOrEmail, password) => {
    try {
      const { user } = await authApi.login(loginOrEmail, password);
      setCurrentUser(user);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Xatolik yuz berdi" };
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    if (typeof window !== "undefined") {
      // Chiqqandan keyin MEHMON bosh sahifasiga o'tamiz.
      //
      // Bu yerda ataylab router.push emas, to'liq qayta yuklash ishlatilgan:
      // currentUser null bo'lishi bilan RequireRole /login'ga yo'naltirishga
      // urinadi va ikkalasi poygaga tushib, foydalanuvchi bosh sahifa o'rniga
      // login sahifasida qolardi. To'liq qayta yuklash bir vaqtning o'zida
      // barcha mijoz holatini (keshlangan ro'yxatlar, bildirishnomalar) ham
      // tozalaydi. Shu sababli setCurrentUser(null) ham chaqirilmaydi.
      window.location.assign("/");
      return;
    }
    setCurrentUser(null);
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const { user } = await authApi.register(payload);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Xatolik yuz berdi" };
    }
  }, []);

  const isLoginTaken = useCallback(async (login) => {
    const { taken } = await authApi.checkLogin(login);
    return taken;
  }, []);

  const updateMe = useCallback(async (patch) => {
    const { user } = await usersApi.updateMe(patch);
    setCurrentUser(user);
    return user;
  }, []);

  const markNotificationsRead = useCallback(
    async (ids) => {
      try {
        const { unread: count } = await notificationsApi.markRead(ids);
        setUnread(count);
        setNotifications((prev) =>
          prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n))
        );
      } catch {
        /* e'tiborsiz */
      }
    },
    []
  );

  const clearNotifications = useCallback(async () => {
    await notificationsApi.clear().catch(() => {});
    setNotifications([]);
    setUnread(0);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      ready,
      login,
      logout,
      register,
      isLoginTaken,
      updateMe,
      notifications,
      unread,
      loadNotifications,
      markNotificationsRead,
      clearNotifications,
    }),
    [
      currentUser,
      ready,
      login,
      logout,
      register,
      isLoginTaken,
      updateMe,
      notifications,
      unread,
      loadNotifications,
      markNotificationsRead,
      clearNotifications,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp AppProvider ichida ishlatilishi kerak");
  return ctx;
}
