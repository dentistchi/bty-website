// bty-app/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// OpenNext/Cloudflare에서 캐시/정적화 방지
export const dynamic = "force-dynamic";
export const revalidate = 0;

function copySetCookie(from: NextResponse, to: NextResponse) {
  const anyHeaders = from.headers as any;
  const setCookies: string[] =
    anyHeaders.getSetCookie?.() ??
    (from.headers.get("set-cookie") ? [from.headers.get("set-cookie")!] : []);
  for (const c of setCookies) to.headers.append("set-cookie", c);
}

export async function POST(req: NextRequest) {
  // 쿠키를 "수집"할 응답 컨테이너
  const cookieRes = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Supabase env missing (url/key)" },
        { status: 503 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      const out = NextResponse.json(
        { ok: false, error: "missing email/password" },
        { status: 400 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const out = NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.signInWithPassword()" },
        { status: 401 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    // ✅ 여기서는 "토큰 반환"도 가능하지만, 지금 목표는 쿠키 세션 확립
    // data.session이 있으면 /api/auth/session POST 없이도 쿠키가 세팅될 수 있음(SSR 쿠키)
    const out = NextResponse.json(
      {
        ok: true,
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        // 필요하면 토큰도 같이 내보낼 수 있음(현재 플로우에 맞춰 선택)
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      },
      { status: 200 }
    );

    copySetCookie(cookieRes, out);
    return out;
  } catch (e: any) {
    // ✅ "빈 body 500" 방지: 항상 JSON
    const out = NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        stack: e?.stack ?? null,
        where: "/api/auth/login POST",
      },
      { status: 500 }
    );
    copySetCookie(cookieRes, out);
    return out;
  }
}
