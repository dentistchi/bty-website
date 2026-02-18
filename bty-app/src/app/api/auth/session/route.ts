import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function copySetCookie(from: NextResponse, to: NextResponse) {
  const anyHeaders = from.headers as any;
  const setCookies: string[] =
    anyHeaders.getSetCookie?.() ??
    (from.headers.get("set-cookie") ? [from.headers.get("set-cookie")!] : []);

  for (const c of setCookies) to.headers.append("set-cookie", c);
}

export async function GET(req: NextRequest) {
  const cookieRes = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, cookieRes);
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase env missing (url/key)" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const out = NextResponse.json(
        { ok: false, error: error.message, where: "supabase.auth.getUser()" },
        { status: 401 }
      );
      copySetCookie(cookieRes, out);
      return out;
    }

    const out = NextResponse.json(
      { ok: true, user: data.user ?? null },
      { status: 200 }
    );
    copySetCookie(cookieRes, out);
    return out;
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(e),
        stack: e?.stack ?? null,
        where: "/api/auth/session GET",
      },
      { status: 500 }
    );
  }
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
