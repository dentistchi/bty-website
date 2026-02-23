import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { appendSetCookies } from "@/lib/bty/cookies/setCookie";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeNext(raw: string | null): string {
  const fallback = "/en/bty/dashboard";
  if (!raw) return fallback;
  let next = raw;
  try {
    next = decodeURIComponent(raw);
  } catch {
    next = raw;
  }
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("/en/bty/login") || next.startsWith("/ko/bty/login")) return fallback;
  return next;
}

/**
 * POST /api/auth/login
 * - returns JSON { ok: true, next }
 * - MUST emit Set-Cookie for supabase auth-token (httpOnly) on success
 */
export async function POST(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const nextPath = sanitizeNext(requestUrl.searchParams.get("next"));

    const body = (await req.json().catch(() => null)) as null | { email?: string; password?: string };
    const email = (body?.email ?? "").trim();
    const password = body?.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_CREDENTIALS" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true, next: nextPath });
    res.headers.set("Cache-Control", "no-store");

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          appendSetCookies(res, cookies);
          res.headers.set("x-cookie-writer", "login");
          res.headers.set("x-auth-set-cookie-count", String(cookies.length));
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "LOGIN_FAILED" },
        { status: 401 }
      );
    }

    await supabase.auth.getSession();

    return res;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), where: "/api/auth/login POST" },
      { status: 500 }
    );
  }
}
