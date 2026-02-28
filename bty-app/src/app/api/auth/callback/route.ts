import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { expireAuthCookiesHard, writeSupabaseAuthCookies } from "@/lib/bty/cookies/authCookies";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Default redirect when code is missing or exchange fails. Locale-aware. */
function defaultLoginRedirect(origin: string, error?: string): URL {
  const path = "/en/bty/login";
  const u = new URL(path, origin);
  if (error) u.searchParams.set("error", error);
  return u;
}

/** Sanitize next param for redirect (must start with /, avoid open redirect). */
function sanitizeNext(raw: string | null, origin: string): string {
  if (!raw || !raw.startsWith("/")) return "/en/bty/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return "/en/bty/dashboard";
    return decoded;
  } catch {
    return "/en/bty/dashboard";
  }
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(defaultLoginRedirect(origin, "missing_code"), 302);
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
    return NextResponse.redirect(
      defaultLoginRedirect(origin, encodeURIComponent(error.message)),
      302
    );
  }

  const redirectUrl = new URL(sanitizeNext(next, origin), origin);
  const res = NextResponse.redirect(redirectUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  expireAuthCookiesHard(req, res);
  writeSupabaseAuthCookies(res, captured);
  return res;
}
