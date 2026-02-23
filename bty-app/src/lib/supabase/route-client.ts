import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Whitelist-only cookie setter: path="/" always, no domain; only expires/maxAge from options. */
export function setAuthCookie(
  res: NextResponse,
  name: string,
  value: string,
  options?: Record<string, unknown>
) {
  const expires = options && "expires" in options ? (options as { expires?: Date }).expires : undefined;
  const maxAge = options && "maxAge" in options ? (options as { maxAge?: number }).maxAge : undefined;

  res.cookies.set(name, value, {
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    ...(expires != null ? { expires } : {}),
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  });
}

const cookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: true,
  httpOnly: true,
};

export function createSupabaseRouteClient(req: NextRequest, res: NextResponse) {
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookies.forEach(({ name, value, options }) => {
          setAuthCookie(res, name, value, options);
        });
      },
    },
  });
}

export function copyCookiesAndDebug(
  from: NextResponse,
  to: NextResponse,
  req: NextRequest,
  userExists: boolean
) {
  to.headers.set("Cache-Control", "no-store");
  to.headers.set("x-auth-user", userExists ? "1" : "0");
  to.headers.set("x-auth-path", new URL(req.url).pathname);
  const all = req.cookies.getAll();
  to.headers.set("x-auth-cookie-count", String(all.length));
  to.headers.set("x-auth-cookie-names", all.slice(0, 8).map((c) => c.name).join(","));
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, cookieOptions);
  }
}

export async function requireUser(req: NextRequest) {
  const base = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = createSupabaseRouteClient(req, base);
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  return { user, supabase, base, error };
}

export function unauthenticated(req: NextRequest, base: NextResponse) {
  const out = NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  copyCookiesAndDebug(base, out, req, false);
  return out;
}
