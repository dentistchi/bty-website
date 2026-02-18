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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchSession(): Promise<AuthUser | null> {
  const res = await fetch(`/api/auth/session?_t=${Date.now()}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await res.json();
  // session API는 항상 200이고 hasSession으로 판단
  if (!data?.ok || !data?.hasSession) return null;
  return data.user; // { id, email }
}

async function apiJson<T>(url: string, body?: any, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // ✅ 핵심
    cache: "no-store",
    ...init,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
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
    await apiJson("/api/auth/login", { email, password });

    const s = await fetch(`/api/auth/session?_t=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
    }).then((r) => r.json());

    if (!s?.ok || !s?.hasSession) throw new Error("세션 생성 실패(쿠키 미설정)");

    // ✅ 상태 업데이트도 하되, 화면 꼬임 방지 위해 하드 이동
    setUser(s.user ?? { id: s.userId, email: s.email ?? null });

    window.location.assign("/bty"); // ✅ 확실하게 화면 전환
  };

  const register = async (email: string, password: string) => {
    setError(null);
    await apiJson("/api/auth/register", { email, password });

    const s = await fetch(`/api/auth/session?_t=${Date.now()}`, {
      credentials: "include",
      cache: "no-store",
    }).then((r) => r.json());
    if (s?.hasSession) setUser(s.user ?? { id: s.userId, email: s.email ?? null });
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
