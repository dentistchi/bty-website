"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/read-json";

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

type SessionResp = { ok: boolean; user?: AuthUser | null };

let sessionInflight: Promise<SessionResp | null> | null = null;

async function fetchSessionOnce(): Promise<SessionResp | null> {
  if (!sessionInflight) {
    sessionInflight = (async () => {
      const r = await fetchJson<SessionResp>("/api/auth/session");
      return r.ok ? r.json : null;
    })().finally(() => {
      sessionInflight = null;
    });
  }
  return sessionInflight;
}

async function fetchSession(): Promise<AuthUser | null> {
  const j = await fetchSessionOnce();
  return j?.ok ? j.user ?? null : null;
}

function throwFromFetchJson(r: { ok: boolean; status: number; raw?: string }) {
  if (r.ok) return;
  let msg = `HTTP ${r.status}`;
  if (r.raw) {
    try {
      const j = JSON.parse(r.raw) as { error?: string; message?: string };
      msg = j.error || j.message || msg;
    } catch {
      // keep msg
    }
  }
  throw new Error(msg);
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
        const j = await fetchSessionOnce();

        if (!mounted) return;
        setUser(j?.ok ? j.user ?? null : null);
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
    const loginRes = await fetchJson<{ error?: string; message?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    throwFromFetchJson(loginRes);

    const j = await fetchSessionOnce();
    if (!j?.ok || !j?.user) throw new Error("세션 생성 실패(쿠키 미설정)");

    setUser(j.user);
    window.location.assign("/bty");
  };

  const register = async (email: string, password: string) => {
    setError(null);
    const regRes = await fetchJson<{ error?: string; message?: string }>("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    throwFromFetchJson(regRes);

    const j = await fetchSessionOnce();
    if (j?.ok && j?.user) setUser(j.user);
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
