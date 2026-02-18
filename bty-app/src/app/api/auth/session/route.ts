import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // 쿠키 setAll()을 위해 res 객체를 먼저 만들고 전달
  const res = NextResponse.next();

  try {
    const supabase = getSupabaseServer(req, res); // ✅ 반드시 (req, res) 2개
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 503 });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    // ✅ res에 set-cookie가 들어갔다면 headers로 전달
    return NextResponse.json(
      { ok: true, user: data.user ?? null },
      { status: 200, headers: res.headers }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e), stack: e?.stack ?? null },
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
