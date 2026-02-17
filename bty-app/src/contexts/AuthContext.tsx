"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = { id: string; email?: string | null };

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  clearError: () => void;
  refreshSession: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  const data = await res.json();
  // session API는 항상 200이고 hasSession으로 판단
  if (!data?.ok || !data?.hasSession) return null;
  return data.user; // { id, email }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debug = () => (typeof window !== "undefined" && (window as any).__AUTH_DEBUG__);

  const clearError = () => setError(null);

  const refreshSession = async () => {
    const u = await fetchSession();
    setUser(u);
    return u;
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = await fetchSession();
        if (!mounted) return;
        setUser(u);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "login failed");
    }

    // ✅ 쿠키가 진짜니까, 바로 세션 재조회
    const u = await refreshSession();
    if (!u) throw new Error("session not established");
    return u;
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
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, error, setError, clearError, refreshSession, login, register, logout }),
    [user, loading, error]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
