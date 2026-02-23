import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // same-origin path only
  if (!next.startsWith("/")) return fallback;

  // prevent login loop
  if (next.startsWith("/en/bty/login") || next.startsWith("/ko/bty/login")) return fallback;

  return next;
}

export async function POST(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const nextPath = sanitizeNext(requestUrl.searchParams.get("next"));

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, {
              ...(options ?? {}),
              path: "/",
              sameSite: "lax",
              secure: true,
              httpOnly: true,
            });
          });
        },
      },
    });

    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json(
        { error: "LOGIN_FAILED", detail: error.message },
        { status: 401 }
      );
    }

    const redirectRes = NextResponse.redirect(new URL(nextPath, req.url), 303);
    redirectRes.headers.set("Cache-Control", "no-store");
    redirectRes.headers.set("x-auth-next", nextPath);

    for (const c of res.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value, {
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
    }

    return redirectRes;
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        where: "/api/auth/login POST",
      },
      { status: 500 }
    );
  }
}
