/**
 * Server-side OAuth code exchange (query `code` only).
 * BTY login (`login-card`) uses `/{locale}/auth/callback` for browser exchange + hash tokens; keep this route for
 * bookmarks or integrations that still redirect to `/api/auth/callback`.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { inferLocaleFromNextParam, sanitizeNextForRedirect } from "@/lib/auth/sanitize-next-for-redirect";
import {
  authCookieSecureForRequest,
  expireAuthCookiesHard,
  writeSupabaseAuthCookies,
} from "@/lib/bty/cookies/authCookies";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Default redirect when code is missing or exchange fails. Locale-aware via `next` hint. */
function defaultLoginRedirect(origin: string, errorCode?: string, nextHint?: string | null): URL {
  const locale = inferLocaleFromNextParam(nextHint);
  const u = new URL(`/${locale}/bty/login`, origin);
  if (errorCode) u.searchParams.set("error", errorCode);
  return u;
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(defaultLoginRedirect(origin, "missing_code", next), 302);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.warn("[auth/callback] exchangeCodeForSession failed", error.message);
    return NextResponse.redirect(defaultLoginRedirect(origin, "oauth_session_failed", next), 302);
  }

  const locale = inferLocaleFromNextParam(next);
  const safeNext = sanitizeNextForRedirect(next, { locale });
  const redirectUrl = new URL(safeNext, origin);
  const res = NextResponse.redirect(redirectUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  const cookieSecure = authCookieSecureForRequest(req);
  expireAuthCookiesHard(req, res, { secure: cookieSecure });
  writeSupabaseAuthCookies(res, captured, { secure: cookieSecure });
  return res;
}
