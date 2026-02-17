import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth-server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildRes(body: any) {
  const res = NextResponse.json(body, { status: 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Surrogate-Control", "no-store");
  res.headers.append("Vary", "Cookie");
  res.headers.set("X-REQ-ID", crypto.randomUUID());
  return res;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") || "";

  const debug = {
    now: Date.now(),
    hasAuthHeader: !!auth,
    hasSbCookie: /sb-[^=]+-auth-token=/.test(cookie),
    cookieLen: cookie.length,
    sbCookieSample: /sb-[^=]+-auth-token=/.test(cookie)
      ? (cookie.match(/sb-[^=]+-auth-token=[^;]+/)?.[0]?.slice(0, 60) ?? null)
      : null,
  };

  const user = await getAuthUserFromRequest(request);
  if (!user) return buildRes({ ok: true, hasSession: false, debug });

  return buildRes({
    ok: true,
    hasSession: true,
    userId: user.id,
    user: { id: user.id, email: user.email ?? null },
    debug,
  });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = getSupabaseServer(req, res);
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string };
  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing access_token/refresh_token" }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  return res;
}
