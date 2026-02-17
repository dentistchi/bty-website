"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = { id: string; email?: string | null };

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debug = () => (typeof window !== "undefined" && (window as any).__AUTH_DEBUG__);

  const clearError = () => setError(null);

  const refreshSession = async () => {
    const r = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });

    const data = await r.json();
    if (debug()) console.log("[auth] session:", data);

    if (data?.ok && data?.hasSession) {
      setUser({ id: data.userId, email: data.user?.email ?? null });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshSession();
      } finally {
        setLoading(false);
        if (debug()) console.log("[auth] boot done. user =", user);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    clearError();

    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();
    if (debug()) console.log("[auth] login:", data);

    if (!data?.ok) {
      setError(data?.error ?? "로그인 실패");
      throw new Error(data?.error ?? "login failed");
    }

    // ✅ 로그인 성공 시 user를 즉시 세팅 (UI가 바로 바뀌게)
    if (data?.userId) setUser({ id: data.userId, email: data.email ?? null });
    else await refreshSession();

    // ✅ router push가 먹통/캐시 꼬임 방지: 하드 이동
    window.location.assign("/bty");
  };

  const register = async (email: string, password: string) => {
    clearError();
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();
    if (!data?.ok) {
      setError(data?.error ?? "회원가입 실패");
      throw new Error(data?.error ?? "register failed");
    }

    await refreshSession();
    window.location.assign("/bty");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });

    setUser(null);

    // ✅ 쿠키가 남아 보이는건 DevTools 지연/리프레시 문제일 수 있어.
    // 실제 판정은 /api/auth/session hasSession=false로 확인.
    window.location.assign("/");
  };

  const value = useMemo(
    () => ({ user, loading, error, clearError, refreshSession, login, register, logout }),
    [user, loading, error]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
