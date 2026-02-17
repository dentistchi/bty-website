import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// sb-<projectref>-auth-token 쿠키에서 access_token 꺼내기 (Workers-safe)
function getAccessTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  // cookieHeader 예: "a=1; sb-xxx-auth-token=base64-....; b=2"
  const parts = cookieHeader.split(";").map((s) => s.trim());
  const sb = parts.find((p) => p.startsWith("sb-") && p.includes("-auth-token="));
  if (!sb) return null;

  const raw = sb.split("=").slice(1).join("="); // 값에 '='가 있을 수 있어 join
  if (!raw) return null;

  const b64 = raw.startsWith("base64-") ? raw.slice(7) : raw;

  try {
    // ✅ Workers/브라우저 환경: atob 사용
    const jsonStr =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8"); // node fallback

    const json = JSON.parse(jsonStr);
    const token = json?.access_token;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Authorization Bearer 우선 → 없으면 cookie에서 access_token 추출
 */
export async function getAuthUserFromRequest(request: Request): Promise<User | null> {
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  const cookieHeader = request.headers.get("cookie");
  const cookieToken = getAccessTokenFromCookieHeader(cookieHeader);

  const token = bearer || cookieToken;
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
