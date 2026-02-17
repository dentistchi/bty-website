import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "edge"; // ✅ Cloudflare/OpenNext 기준
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildRes(body: any) {
  const res = NextResponse.json(body, { status: 200 });

  // ✅ 절대 캐시 금지 (브라우저/프록시/CDN)
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Surrogate-Control", "no-store");

  // ✅ bearer/cookie 둘 다 쓰므로 Vary 둘 다 포함
  res.headers.append("Vary", "Cookie");
  res.headers.append("Vary", "Authorization");

  // ✅ 요청마다 값이 바뀌는 헤더(캐시/혼선 추적용)
  res.headers.set("X-REQ-ID", crypto.randomUUID());
  return res;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") || "";

  const hasAuthHeader = !!auth;
  const hasSbCookie = /sb-[^=]+-auth-token=/.test(cookie);
  const cookieLen = cookie.length;

  const user = await getAuthUserFromRequest(request);

  const debug = {
    now: Date.now(),
    hasAuthHeader,
    hasSbCookie,
    cookieLen,
    // 민감정보 없이 "sb 쿠키 존재 여부"만 짧게 확인
    sbCookieSample: hasSbCookie
      ? cookie.match(/sb-[^=]+-auth-token=[^;]+/)?.[0]?.slice(0, 60) ?? null
      : null,
  };

  if (!user) {
    return buildRes({ ok: true, hasSession: false, debug });
  }

  return buildRes({
    ok: true,
    hasSession: true,
    userId: user.id,
    user: { id: user.id, email: user.email ?? null },
    debug,
  });
}

/** 클라이언트에서 받은 access_token/refresh_token으로 세션 쿠키 설정 */
export async function POST(req: NextRequest) {
  // ✅ buildRes를 쓰면 헤더가 동일하게 들어가지만,
  // 여기서는 set-cookie가 붙어야 해서 res를 먼저 만든 후 body만 교체하는 방식 사용
  const res = buildRes({ ok: true });

  const supabase = getSupabaseServer(req, res);
  if (!supabase) {
    return buildRes({ ok: false, error: "Server not configured" });
  }

  const body = (await req.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };

  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return buildRes({ ok: false, error: "missing access_token/refresh_token" });
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return buildRes({ ok: false, error: error.message });
  }

  // ✅ setSession 과정에서 setAll이 호출되어 res에 쿠키가 심김
  return res;
}
