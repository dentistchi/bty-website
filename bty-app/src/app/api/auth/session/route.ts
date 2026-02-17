import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * ✅ 캐시 방지 (Next + Edge/Workers 모두)
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(body: any) {
  const res = NextResponse.json(body, { status: 200 });
  // ✅ 절대 캐시 금지
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  // ✅ Cookie에 따라 응답이 달라져야 함
  res.headers.set("Vary", "Cookie");
  // 디버그용(원인 확정)
  res.headers.set("X-BTY-SESSION", body?.hasSession ? "1" : "0");
  return res;
}

export async function GET(request: Request) {
  // (1) Authorization bearer
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  // (2) Cookie 존재 여부(디버그)
  const cookie = request.headers.get("cookie") || "";
  const hasSbCookie = /sb-.*-auth-token=/.test(cookie);

  // ✅ getAuthUserFromRequest가 bearer/cookie 둘 다 처리
  const user = await getAuthUserFromRequest(request);

  if (!user) {
    return noStoreJson({
      ok: true,
      hasSession: false,
      debug: {
        hasAuthHeader: !!bearer,
        hasSbCookie,
      },
    });
  }

  return noStoreJson({
    ok: true,
    hasSession: true,
    userId: user.id,
    user: { id: user.id, email: user.email ?? null },
    debug: {
      hasAuthHeader: !!bearer,
      hasSbCookie,
    },
  });
}

/** 클라이언트에서 받은 access_token/refresh_token으로 세션 쿠키 설정 */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = getSupabaseServer(req, res);
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string };
  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing access_token/refresh_token" }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  // ✅ setSession 과정에서 setAll이 호출되어 res에 쿠키가 심김
  return res;
}
