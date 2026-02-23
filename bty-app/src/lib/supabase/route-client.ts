import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
          res.cookies.set(name, value, { ...(options ?? {}), ...cookieOptions });
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
