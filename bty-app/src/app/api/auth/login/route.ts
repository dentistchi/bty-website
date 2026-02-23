import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { setAuthCookie } from "@/lib/supabase/route-client";

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

export async function POST(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const nextPath = sanitizeNext(requestUrl.searchParams.get("next"));

    const res = NextResponse.json({ ok: false }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("x-auth-login", "1");
    res.headers.set("x-auth-next", nextPath);

    const supabase = createServerClient(url, key, {
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

    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      const out = NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
      res.headers.forEach((v, k) => out.headers.set(k, v));
      return out;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const out = NextResponse.json(
        { error: "LOGIN_FAILED", detail: error.message },
        { status: 401 }
      );
      res.headers.forEach((v, k) => out.headers.set(k, v));
      return out;
    }

    const out = NextResponse.json({ ok: true, next: nextPath }, { status: 200 });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    for (const c of res.cookies.getAll()) {
      setAuthCookie(out, c.name, c.value);
    }
    return out;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), where: "/api/auth/login POST" },
      { status: 500 }
    );
  }
}
