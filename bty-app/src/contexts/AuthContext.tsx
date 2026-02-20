"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "@/lib/read-json";
import { sanitizeNext } from "@/lib/sanitize-next";

type AuthUser = {
  id: string;
  email?: string | null;
} | null;

type SessionResp = { ok: boolean; user?: any | null; error?: string; where?: string };
type LoginResp =
  | { ok: true; access_token: string; refresh_token: string; user?: { id: string; email?: string | null } | null }
  | { ok: false; error?: string; where?: string };

type RegisterResp =
  | { ok: true; access_token?: string; refresh_token?: string; needs_email_confirm?: boolean; user?: { id: string; email?: string | null } | null }
  | { ok: false; error?: string; where?: string };

type Ctx = {
  user: AuthUser;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  login: (email: string, password: string, next?: string) => Promise<void>;
  register: (email: string, password: string, next?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

function safeJson(raw?: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function msgFromFetchFail(r: { raw?: string }) {
  const obj = safeJson(r.raw) as { error?: string; message?: string; where?: string } | null;
  return obj?.error ?? obj?.message ?? r.raw ?? "Request failed";
}

function assertOk<T extends { ok: boolean }>(
  r: { ok: boolean; status: number; json?: T; raw?: string },
  fallbackMsg: string
): asserts r is { ok: true; status: number; json: T } {
  if (!r.ok) throw new Error(msgFromFetchFail(r) || fallbackMsg);
}

let sessionInflight: Promise<SessionResp | null> | null = null;

/** ✅ 중복 GET 방지 + 실패 시 null */
async function fetchSessionOnce(): Promise<SessionResp | null> {
  if (!sessionInflight) {
    sessionInflight = (async () => {
      const r = await fetchJson<SessionResp>(`/api/auth/session?_t=${Date.now()}`);
      if (!r.ok) {
        // 401(로그인 전)은 정상 흐름 → 에러로 취급하지 않고 비로그인 상태로 둠 (콘솔/UI 노이즈 제거)
        if (r.status === 401) return { ok: false as const };
        throw new Error(r.raw ?? "Session request failed");
      }
      // 200 + body.ok:false(세션 없음)도 그대로 반환, throw 안 함
      return r.json as SessionResp;
    })().finally(() => {
      sessionInflight = null;
    });
  }
  return sessionInflight;
}

/** ✅ 로그인 직후 쿠키 반영 레이스를 피하기 위한 재시도 */
async function fetchSessionAfterLogin(retries = 3, delayMs = 120): Promise<SessionResp | null> {
  for (let i = 0; i < retries; i++) {
    // 캐시된 inflight 무조건 끊고 새 GET 강제
    sessionInflight = null;
    const j = await fetchSessionOnce();
    if (j?.ok && j.user) return j;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // ✅ 로그인/공개 페이지에서는 세션 자동조회 자체를 하지 않음 (401 노이즈 제거)
  const skipInitialSessionCheck =
    pathname === "/bty/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/bty/login") ||
    pathname.startsWith("/admin/login");

  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const j = await fetchSessionOnce();
      if (!mounted.current) return;
      setUser(j?.ok ? (j.user ?? null) : null);
    } catch (e: any) {
      if (!mounted.current) return;
      setUser(null);
      setError(e?.message ?? String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ✅ 로그인/공개 페이지에서는 세션 자동조회 자체를 하지 않음 (401 노이즈 제거)
    if (skipInitialSessionCheck) {
      // 로그인 페이지에서는 loading을 false로 설정 (초기 로딩 완료)
      if (mounted.current) setLoading(false);
      return;
    }
    refresh();
  }, [refresh, skipInitialSessionCheck, pathname]);

  const login = useCallback(async (email: string, password: string, next?: string) => {
    setError(null);
    setLoading(true);

    try {
      // 1) 로그인 → 토큰 받기
      const r1 = await fetchJson<LoginResp>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!r1.ok) throw new Error(msgFromFetchFail(r1));
      if (!r1.json || (r1.json as any).ok !== true) throw new Error((r1.json as any)?.error ?? "Login failed");

      const data = r1.json as Extract<LoginResp, { ok: true }>;
      const access_token = data.access_token;
      const refresh_token = data.refresh_token;

      if (!access_token || !refresh_token) throw new Error("missing tokens");

      // 2) 토큰으로 쿠키 세션 세팅 (⭐ 여기서 Set-Cookie가 내려와야 함)
      const r2 = await fetchJson<{ ok: boolean; error?: string }>("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });
      assertOk(r2 as any, "Session POST failed");
      if (!r2.json?.ok) throw new Error(r2.json?.error ?? "세션 생성 실패(쿠키 미설정)");

      // ✅ 캐시 리셋하여 새로운 GET 요청 강제
      sessionInflight = null;

      // 3) 쿠키 반영될 때까지 GET 재시도 (반드시 200 {ok:true,user} 받을 때까지)
      const j = await fetchSessionAfterLogin();
      if (!j?.ok || !j.user) throw new Error("세션 생성 실패(쿠키 미설정)");

      if (mounted.current) setUser(j.user);

      // 4) 이동 - next 검증 후 서버 after-login을 거쳐 리다이렉트 (redirect loop 방지)
      const nextSafe = sanitizeNext(next);
      window.location.assign(`/api/auth/after-login?next=${encodeURIComponent(nextSafe)}`);
    } catch (e: any) {
      if (mounted.current) {
        setUser(null);
        setError(e?.message ?? String(e));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, next?: string) => {
    setError(null);
    setLoading(true);

    try {
      // 1) 회원가입 → (설정에 따라) 토큰이 올 수도/안 올 수도 있음
      const r1 = await fetchJson<RegisterResp>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!r1.ok) throw new Error(msgFromFetchFail(r1));
      if (!r1.json || (r1.json as any).ok !== true) throw new Error((r1.json as any)?.error ?? "Register failed");

      const data = r1.json as Extract<RegisterResp, { ok: true }>;

      // 이메일 확인이 필요한 경우: 여기서 종료 (UI 메시지)
      if (data.needs_email_confirm) {
        if (mounted.current) {
          setUser(null);
          setError("이메일 확인이 필요합니다. 받은 메일에서 인증 후 다시 로그인해주세요.");
        }
        return;
      }

      const access_token = data.access_token;
      const refresh_token = data.refresh_token;

      if (!access_token || !refresh_token) {
        // needs_email_confirm가 아닌데 토큰이 없다면 서버 설정/응답 이상
        throw new Error("missing tokens");
      }

      // 2) 토큰으로 쿠키 세션 세팅
      const r2 = await fetchJson<{ ok: boolean; error?: string }>("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });
      assertOk(r2 as any, "Session POST failed");
      if (!r2.json?.ok) throw new Error(r2.json?.error ?? "세션 생성 실패(쿠키 미설정)");

      // ✅ 캐시 리셋하여 새로운 GET 요청 강제
      sessionInflight = null;

      // 3) 쿠키 반영될 때까지 GET 재시도 (반드시 200 {ok:true,user} 받을 때까지)
      const j = await fetchSessionAfterLogin();
      if (!j?.ok || !j.user) throw new Error("세션 생성 실패(쿠키 미설정)");

      if (mounted.current) setUser(j.user);

      // 4) 이동 - next 검증 후 서버 after-login을 거쳐 리다이렉트 (redirect loop 방지)
      const nextSafe = sanitizeNext(next);
      window.location.assign(`/api/auth/after-login?next=${encodeURIComponent(nextSafe)}`);
    } catch (e: any) {
      if (mounted.current) {
        setUser(null);
        setError(e?.message ?? String(e));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // 서버에 logout route가 있으면 호출해도 좋지만, 지금은 쿠키 기반이라
    // supabase signOut route를 만들거나, 쿠키 삭제 route를 만들기 전까지는
    // 사용자 상태만 비우고 refresh로 동기화하는 방식
    setUser(null);
    sessionInflight = null;
    await refresh();
    window.location.assign("/bty/login");
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({ user, loading, error, clearError, refresh, login, register, logout }),
    [user, loading, error, clearError, refresh, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
