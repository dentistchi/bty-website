import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { copySetCookies } from "@/lib/cookie-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.append("Vary", "Cookie");
  return res;
}

export async function POST(req: NextRequest) {
  // ✅ 쿠키를 심기 위한 "템플릿 응답"
  const cookieRes = noStore(NextResponse.json({ ok: false }, { status: 200 }));
  const supabase = getSupabaseServer(req, cookieRes);

  if (!supabase) {
    return noStore(NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 }));
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return noStore(NextResponse.json({ ok: false, error: "missing email or password" }, { status: 400 }));
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // ✅ 실패는 반드시 401
    return noStore(
      NextResponse.json(
        { ok: false, error: error?.message ?? "Invalid login credentials" },
        { status: 401 }
      )
    );
  }

  // ✅ access_token과 refresh_token을 프론트엔드에 반환
  // 프론트엔드에서 /api/auth/session POST로 쿠키 세션을 설정하도록 함
  const successRes = noStore(
    NextResponse.json(
      {
        ok: true,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id ?? null,
          email: data.user?.email ?? null,
        },
      },
      { status: 200 }
    )
  );

  // ✅ cookieRes에 심긴 Set-Cookie를 successRes로 복사
  // (Supabase가 자동으로 쿠키를 설정하지만, 프론트엔드에서도 토큰을 받아서
  // /api/auth/session POST로 명시적으로 쿠키를 설정할 수 있도록 함)
  copySetCookies(cookieRes, successRes);

  return successRes;
}
