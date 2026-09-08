"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, usersApi, ApiError, wsUrl } from "./api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => setCurrentUser(null))
      .finally(() => setReady(true));
  }, []);

  // Onlayn holatni backendga bildirish uchun WS ulanishi — foydalanuvchi
  // tizimga kirgan bo'lsa ochiladi, chiqqanda yopiladi.
  useEffect(() => {
    if (!currentUser) return;
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [currentUser?.id]);

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

  const value = useMemo(
    () => ({ currentUser, ready, login, logout, register, isLoginTaken, updateMe }),
    [currentUser, ready, login, logout, register, isLoginTaken, updateMe]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp AppProvider ichida ishlatilishi kerak");
  return ctx;
}
