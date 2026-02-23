// bty-app/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerWithCookieCapture } from "@/lib/supabase-server";

// OpenNext/Cloudflare에서 캐시/정적화 방지
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { supabase, applyCookiesToResponse } = await getSupabaseServerWithCookieCapture(req);

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

    const res = NextResponse.json(
      {
        ok: true,
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      },
      { status: 200 }
    );
    applyCookiesToResponse(res);
    res.headers.set("x-auth-cookie-path", "/");
    return res;
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
