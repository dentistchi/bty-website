import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServerWithCookieCapture } from "@/lib/supabase-server";
import { mergeCookiesForRouteHandler } from "@/lib/supabase/route-client";
import {
  authCookieSecureForRequest,
  expireAuthCookiesHard,
  writeSupabaseAuthCookies,
} from "@/lib/bty/cookies/authCookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SESSION_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error("Session timeout")), SESSION_TIMEOUT_MS);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

// GET: 쿠키 기반 세션에서 user 확인 (미로그인은 200 + ok:false로 401 노이즈 제거).
// 항상 JSON 본문 반환 — 빈 body로 인한 클라이언트 "Unexpected end of JSON input" 방지.
//
// STEP A — session gate refresh. Cold relaunch enters through /start, which is locale-less and
// outside the middleware matcher, so this gate is the only session check a returning user hits.
// When the access token is expired/invalid but the persistent refresh_token cookie is still
// valid, refresh the session here and persist the ROTATED Supabase auth cookies via the existing
// writer (Path=/, persistent Max-Age, same secure/sameSite/domain semantics) — otherwise a normal
// access-token expiry forces the user back to Google login. Refresh failure preserves the prior
// unauthenticated response and does NOT clear cookies (read-only fallback unchanged).
export async function GET(req: NextRequest) {
  try {
    const { supabase, applyCookiesToResponse } = await getSupabaseServerWithCookieCapture(req);

    // 1) Validate the current access token.
    let user: { id: string; email?: string | null } | null = null;
    try {
      const { data } = await withTimeout(supabase.auth.getUser());
      if (data?.user) user = { id: data.user.id, email: data.user.email };
    } catch {
      user = null;
    }

    // 2) Expired/invalid access token → refresh using the stored refresh_token cookie.
    if (!user) {
      try {
        const { data, error } = await withTimeout(supabase.auth.refreshSession());
        if (!error && data?.user) user = { id: data.user.id, email: data.user.email };
      } catch {
        // refresh failed/timeout → fall through to the unauthenticated response
      }
    }

    // 3) No valid session and refresh did not recover → existing unauthenticated shape.
    //    Do NOT clear cookies (matches the prior read-only behavior).
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Auth session missing!", where: "supabase.auth.getUser()" },
        { status: 200 }
      );
    }

    // 4) Authenticated → persist any rotated cookies (refresh_token rotation) and return the
    //    existing authenticated shape. Nothing was rotated (token still valid) → writes nothing.
    const res = NextResponse.json({ ok: true, user }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    applyCookiesToResponse(res);
    return res;
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
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return mergeCookiesForRouteHandler(req, cookieStore);
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const c of cookiesToSet) captured.push({ name: c.name, value: c.value, options: c.options });
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
    const cookieSecure = authCookieSecureForRequest(req);
    expireAuthCookiesHard(req, res, { secure: cookieSecure });
    writeSupabaseAuthCookies(res, captured, { secure: cookieSecure });
    return res;
  } catch (err) {
    console.error("SESSION POST ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Session route crashed" },
      { status: 500 }
    );
  }
}
