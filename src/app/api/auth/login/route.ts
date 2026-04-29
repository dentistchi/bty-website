import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { inferLocaleFromNextParam, sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import {
  authCookieSecureForRequest,
  expireAuthCookiesHard,
  writeSupabaseAuthCookies,
} from "@/lib/bty/cookies/authCookies";
import { mergeCookiesForRouteHandler } from "@/lib/supabase/route-client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    if (!url || !key) {
      console.error("[auth/login] Missing env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return NextResponse.json({ ok: false, error: "SERVER_CONFIG" }, { status: 500 });
    }

    const requestUrl = new URL(req.url);
    const rawNext = requestUrl.searchParams.get("next");
    const locale = inferLocaleFromNextParam(rawNext);
    const nextPath = sanitizeNextForRedirect(rawNext, { locale });

    const body = (await req.json().catch(() => null)) as null | { email?: string; password?: string };
    const email = (body?.email ?? "").trim();
    const password = body?.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_CREDENTIALS" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true, next: nextPath });
    res.headers.set("Cache-Control", "no-store");

    const cookieSecure = authCookieSecureForRequest(req);
    expireAuthCookiesHard(req, res, { secure: cookieSecure });

    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return mergeCookiesForRouteHandler(req, cookieStore);
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          writeSupabaseAuthCookies(res, cookiesToSet, { secure: cookieSecure });
          res.headers.set("x-cookie-writer", "login");
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      // Server log for debugging (e.g. invalid credentials, fetch failed = wrong URL/key or network)
      const cause = error?.cause != null ? String(error.cause) : "";
      console.warn("[auth/login] signInWithPassword failed", { email: email.slice(0, 3) + "***", error: error?.message, cause: cause || "(none)" });
      return NextResponse.json({ ok: false, error: error?.message ?? "LOGIN_FAILED" }, { status: 401 });
    }

    await supabase.auth.getSession();

    res.headers.set("x-auth-next", nextPath);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error ? (e.cause instanceof Error ? e.cause.message : String(e.cause ?? "")) : "";
    console.error("[auth/login] Error", msg, cause || "");
    return NextResponse.json(
      { error: msg, where: "/api/auth/login POST" },
      { status: 500 }
    );
  }
}
