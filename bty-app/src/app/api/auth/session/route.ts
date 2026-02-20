import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// GET: 쿠키 기반 세션에서 user 확인 (미로그인은 200 + ok:false로 401 노이즈 제거)
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: "Auth session missing!", where: "supabase.auth.getUser()" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Session check failed", where: "GET catch" },
      { status: 500 }
    );
  }
}

// POST: access_token/refresh_token을 받아 쿠키 세션 설정
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const access_token = body?.access_token as string | undefined;
    const refresh_token = body?.refresh_token as string | undefined;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "Missing tokens" }, { status: 400 });
    }

    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "setSession failed" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200 }
    );
  } catch (err) {
    console.error("SESSION POST ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "Session route crashed" },
      { status: 500 }
    );
  }
}
