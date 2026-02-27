import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "@/lib/supabase-server";
import { writeSupabaseAuthCookies, expireAuthCookiesHard } from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SESSION_TIMEOUT_MS = 5000;

// GET: 쿠키 기반 세션에서 user 확인 (미로그인은 200 + ok:false로 401 노이즈 제거)
export async function GET() {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Session timeout")), SESSION_TIMEOUT_MS)
    );
    const supabase = await getSupabaseServer();
    const result = await Promise.race([
      supabase.auth.getUser(),
      timeout,
    ]);
    const { data, error } = result as { data: { user: { id: string; email?: string | null } } | null; error: unknown };

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: "Auth session missing!", where: "supabase.auth.getUser()" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Session check failed", where: "GET catch" },
      { status: 200 }
    );
  }
}

// POST: access_token/refresh_token을 받아 쿠키 세션 설정
// 쿠키를 NextResponse에 직접 Path=/ 로 설정해 /api/* 요청에도 쿠키가 붙도록 함 (Edge/next/headers path 이슈 회피)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const access_token = body?.access_token as string | undefined;
    const refresh_token = body?.refresh_token as string | undefined;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "Missing tokens" }, { status: 400 });
    }

    const captured: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const c of cookies) captured.push({ name: c.name, value: c.value, options: c.options });
        },
      },
    });

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "setSession failed" },
        { status: 401 }
      );
    }

    const res = NextResponse.json(
      { ok: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200 }
    );
    res.headers.set("Cache-Control", "no-store");
    // 기존 /ko, /en 등 잘못된 path 쿠키 제거 후 path=/ 로만 설정
    expireAuthCookiesHard(req, res);
    writeSupabaseAuthCookies(res, captured);
    return res;
  } catch (err) {
    console.error("SESSION POST ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Session route crashed" },
      { status: 500 }
    );
  }
}
