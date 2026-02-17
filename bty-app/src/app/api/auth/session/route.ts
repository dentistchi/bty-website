import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const req = request as NextRequest;
  const tempRes = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = getSupabaseServer(req, tempRes);
  if (!supabase) {
    return NextResponse.json({ ok: true, hasSession: false }, { status: 200 });
  }

  const { data: { user }, error } = await supabase.auth.getUser();

  const body = user
    ? { ok: true, hasSession: true, userId: user.id, user: { id: user.id, email: user.email ?? null } }
    : { ok: true, hasSession: false };

  const res = NextResponse.json(body, { status: 200 });
  res.headers.set("Cache-Control", "no-store, max-age=0");

  const setCookies = tempRes.headers.getSetCookie?.();
  if (setCookies?.length) {
    setCookies.forEach((cookie) => res.headers.append("set-cookie", cookie));
  }

  return res;
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
