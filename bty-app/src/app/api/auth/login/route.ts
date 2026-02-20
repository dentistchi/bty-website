import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { copySetCookies } from "@/lib/cookie-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  // ✅ route handler에서 쿠키를 모아둘 "빈 응답" (NextResponse.next() 대신)
  const cookieRes = new NextResponse(null, { status: 200 });

  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Supabase env missing (url/key)", where: "/api/auth/login POST" },
        { status: 503 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      const out = NextResponse.json(
        { ok: false, error: "missing email/password", where: "/api/auth/login POST" },
        { status: 400 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const out = NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.signInWithPassword" },
        { status: 401 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    // ✅ 세션 토큰을 프론트로 내려주고 (세션 POST로 쿠키 세팅하는 플로우 유지)
    const out = NextResponse.json(
      {
        ok: true,
        access_token: data.session?.access_token ?? null,
        refresh_token: data.session?.refresh_token ?? null,
        user: { id: data.user?.id ?? null, email: data.user?.email ?? null },
      },
      { status: 200 }
    );

    // ✅ Supabase SSR이 cookieRes에 set한 Set-Cookie를 out으로 복사
    copySetCookies(cookieRes, out);
    return out;
  } catch (e: any) {
    // ✅ 500이어도 무조건 JSON body가 내려가게 강제
    const out = NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        where: "/api/auth/login POST catch",
        stack: e?.stack ?? null,
      },
      { status: 500 }
    );
    copySetCookies(cookieRes, out);
    return out;
  }
}
