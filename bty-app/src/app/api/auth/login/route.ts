// bty-app/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// OpenNext/Cloudflare에서 캐시/정적화 방지
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "missing email/password" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.signInWithPassword()" },
        { status: 401 }
      );
    }

    // ✅ 여기서는 "토큰 반환"도 가능하지만, 지금 목표는 쿠키 세션 확립
    // data.session이 있으면 /api/auth/session POST 없이도 쿠키가 세팅될 수 있음(SSR 쿠키)
    return NextResponse.json(
      {
        ok: true,
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        // 필요하면 토큰도 같이 내보낼 수 있음(현재 플로우에 맞춰 선택)
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      },
      { status: 200 }
    );
  } catch (e: any) {
    // ✅ "빈 body 500" 방지: 항상 JSON
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        stack: e?.stack ?? null,
        where: "/api/auth/login POST",
      },
      { status: 500 }
    );
  }
}
