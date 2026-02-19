/**
 * Shared auth client for bty and Dear Me. Same API base = one account.
 */

import { fetchJson } from "@/lib/read-json";
import { safeParse } from "@/lib/safeParse";

const AUTH_TOKEN_KEY = "bty_auth_token";

export type AuthUser = { id: string; email: string };

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_AUTH_API_URL ?? "";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

type SessionResp = { ok?: boolean; user?: AuthUser | null };

export async function fetchSession(token: string | null): Promise<AuthUser | null> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/session` : "/api/auth/session";
  const r = await fetchJson<SessionResp>(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!r.ok) return null;
  return r.json?.user ?? null;
}

type LoginResp = { token?: string; user?: AuthUser; error?: string };

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/login` : "/api/auth/login";
  const r = await fetchJson<LoginResp>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const errObj = safeParse<{ error?: string; message?: string }>(r.raw);
    const msg = errObj?.error ?? errObj?.message ?? r.raw ?? "로그인에 실패했어요.";
    throw new Error(msg);
  }
  if (!r.json?.token || !r.json?.user) throw new Error("로그인 응답 형식 오류");
  return { token: r.json.token, user: r.json.user };
}

type RegisterResp = { token?: string; user?: AuthUser; error?: string };

export async function register(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/register` : "/api/auth/register";
  const r = await fetchJson<RegisterResp>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const errObj = safeParse<{ error?: string; message?: string }>(r.raw);
    const msg = errObj?.error ?? errObj?.message ?? r.raw ?? "회원가입에 실패했어요.";
    throw new Error(msg);
  }
  if (!r.json?.token || !r.json?.user) throw new Error("회원가입 응답 형식 오류");
  return { token: r.json.token, user: r.json.user };
}

/** Build URL for the other site with token in hash so it can store and stay logged in */
export function buildCrossSiteLoginUrl(otherSiteOrigin: string, token: string): string {
  return `${otherSiteOrigin}#bty_token=${encodeURIComponent(token)}`;
}

export function readTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get("bty_token");
}
