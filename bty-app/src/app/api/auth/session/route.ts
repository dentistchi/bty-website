import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { copySetCookies } from "@/lib/cookie-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // ✅ Route handler에서는 NextResponse.next() 금지 → 빈 response 사용
  const cookieRes = new NextResponse(null);

  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Supabase env missing (url/key)" },
        { status: 503 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const out = NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.getUser()" },
        { status: 401 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const out = NextResponse.json(
      { ok: true, user: data.user ?? null },
      { status: 200 }
    );
    copySetCookies(cookieRes, out);
    return out;
  } catch (e: any) {
    const out = NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        where: "/api/auth/session GET",
      },
      { status: 500 }
    );
    copySetCookies(cookieRes, out);
    return out;
  }
}

export async function POST(req: NextRequest) {
  const cookieRes = new NextResponse(null);

  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      const out = NextResponse.json(
        { ok: false, error: "Server not configured" },
        { status: 503 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const body = (await req.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
    };
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      const out = NextResponse.json(
        { ok: false, error: "missing access_token/refresh_token" },
        { status: 400 }
      );
      copySetCookies(cookieRes, out);
      return out;
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      const out = NextResponse.json({ ok: false, error: error.message }, { status: 401 });
      copySetCookies(cookieRes, out);
      return out;
    }

    const out = NextResponse.json({ ok: true }, { status: 200 });
    copySetCookies(cookieRes, out);
    return out;
  } catch (e: any) {
    const out = NextResponse.json(
      { ok: false, error: e?.message ?? String(e), where: "/api/auth/session POST" },
      { status: 500 }
    );
    copySetCookies(cookieRes, out);
    return out;
  }
}
