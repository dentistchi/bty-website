import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type SupabaseCookieSession = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  user?: unknown;
};

/**
 * Authorization: Bearer <token> 우선.
 * 없으면 Cookie의 sb-*-auth-token에서 access_token을 꺼내 Supabase Auth로 유저 확인.
 */
export async function getAuthUserFromRequest(request: Request): Promise<User | null> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  // 1) Authorization 헤더 우선
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  // 2) 없으면 쿠키에서 토큰 추출
  const token = bearer ?? extractAccessTokenFromCookieHeader(request.headers.get("cookie"));

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

/** cookie header에서 sb-*-auth-token을 찾아 access_token을 반환 */
function extractAccessTokenFromCookieHeader(cookieHeader: string | null): string | null {
  const raw = findCookieValue(cookieHeader, (name) => name.includes("-auth-token"));
  if (!raw) return null;

  // 쿠키는 URL-encoded일 수 있음
  const decoded = safeDecodeURIComponent(raw);

  // Supabase 쿠키 형태: "base64-<base64json>"
  const session = parseSupabaseSession(decoded);
  const accessToken = session?.access_token;

  return typeof accessToken === "string" && accessToken.length > 0 ? accessToken : null;
}

/** cookie header에서 predicate에 맞는 쿠키 value 반환 */
function findCookieValue(
  cookieHeader: string | null,
  namePredicate: (name: string) => boolean
): string | null {
  if (!cookieHeader) return null;

  // "a=b; c=d" 파싱
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1);

    if (namePredicate(name)) return value;
  }
  return null;
}

function safeDecodeURIComponent(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** base64- prefix 포함 가능. base64 decode 후 JSON 파싱 */
function parseSupabaseSession(value: string): SupabaseCookieSession | null {
  const v = value.startsWith("base64-") ? value.slice("base64-".length) : value;

  // base64 문자열이 아닐 수도 있으니 try/catch로 안전하게
  const jsonText = safeBase64Decode(v);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === "object" ? (parsed as SupabaseCookieSession) : null;
  } catch {
    return null;
  }
}

function safeBase64Decode(b64: string): string | null {
  try {
    // atob는 Node에서 없을 수 있으니 Buffer 우선
    // (nodejs_compat 환경에서는 Buffer 사용 가능)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B: any = (globalThis as any).Buffer;
    if (B?.from) return B.from(b64, "base64").toString("utf-8");

    // 브라우저/런타임에 atob가 있으면 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: any = (globalThis as any).atob;
    if (typeof a === "function") return a(b64);

    return null;
  } catch {
    return null;
  }
}
