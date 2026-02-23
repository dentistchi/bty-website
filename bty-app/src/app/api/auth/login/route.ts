// bty-app/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerWithCookieCapture } from "@/lib/supabase-server";

// OpenNext/Cloudflare에서 캐시/정적화 방지
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_NEXT = "/en/bty/dashboard";
const LOGIN_PATHS = ["/en/bty/login", "/ko/bty/login"];

function sanitizeNext(raw: string | null): string {
  if (raw == null || raw === "") return DEFAULT_NEXT;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return DEFAULT_NEXT;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return DEFAULT_NEXT;
  const normalized = decoded.split("?")[0];
  if (LOGIN_PATHS.some((p) => normalized === p || normalized.startsWith(p + "/"))) return DEFAULT_NEXT;
  return decoded;
}

export async function POST(req: NextRequest) {
  try {
    const rawNext = req.nextUrl.searchParams.get("next");
    const sanitizedNext = sanitizeNext(rawNext);

    const { supabase, applyCookiesToResponse } = await getSupabaseServerWithCookieCapture(req);

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "missing email/password" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.signInWithPassword()" },
        { status: 401 }
      );
    }

    const redirectUrl = new URL(sanitizedNext, req.url).toString();
    const res = NextResponse.redirect(redirectUrl, 303);
    applyCookiesToResponse(res);
    res.headers.set("x-auth-cookie-path", "/");
    res.headers.set("x-auth-next", sanitizedNext);
    return res;
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        stack: e?.stack ?? null,
        where: "/api/auth/login POST",
      },
      { status: 500 }
    );
  }
}
