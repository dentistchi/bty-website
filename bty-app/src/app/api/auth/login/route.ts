import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: false }, { status: 200 });
  const supabase = getSupabaseServer(req, res);
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "missing email/password" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  // ✅ signInWithPassword 과정에서 setAll이 호출되며 res에 쿠키가 심김
  // res의 쿠키를 새 응답에 복사해야 쿠키가 전달됨
  const response = NextResponse.json(
    { ok: true, userId: data.user?.id ?? null, email: data.user?.email ?? null },
    { status: 200 }
  );
  
  // res에 설정된 쿠키를 새 응답에 복사
  const setCookies = res.headers.getSetCookie();
  if (setCookies) {
    setCookies.forEach((cookie) => {
      response.headers.append("set-cookie", cookie);
    });
  }
  
  return response;
}
