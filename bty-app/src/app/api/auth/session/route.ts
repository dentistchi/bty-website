import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = getSupabaseServer(req, res);
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json({ ok: false, hasSession: false, error: error.message }, { status: 401 });
  }

  // res에 설정된 쿠키를 새 응답에 복사 (refresh 등으로 쿠키가 업데이트될 수 있음)
  const response = NextResponse.json(
    {
      ok: true,
      hasSession: !!data.user,
      userId: data.user?.id ?? null,
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
    },
    { status: data.user ? 200 : 401 }
  );
  
  const setCookies = res.headers.getSetCookie();
  if (setCookies) {
    setCookies.forEach((cookie) => {
      response.headers.append("set-cookie", cookie);
    });
  }
  
  return response;
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
