/**
 * Shared auth client for bty and Dear Me. Same API base = one account.
 */

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

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function fetchSession(token: string | null): Promise<AuthUser | null> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/session` : "/api/auth/session";
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`, {
    credentials: "include",
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  return data.user || null;
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/login` : "/api/auth/login";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "로그인에 실패했어요.");
  return { token: data.token, user: data.user };
}

export async function register(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const base = getApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/register` : "/api/auth/register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "회원가입에 실패했어요.");
  return { token: data.token, user: data.user };
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
