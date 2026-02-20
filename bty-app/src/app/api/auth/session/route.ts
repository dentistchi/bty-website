import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * GET: 세션 조회
 * - "미로그인"은 운영상 정상 케이스라 401을 쓰지 않고 200 + { ok:false }로 반환
 *   (브라우저 콘솔/네트워크 401 노이즈 제거 목적)
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.getUser();

    // 로그인 안 됨: 200 + ok:false
    if (error || !data?.user) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json(
      { ok: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200 }
    );
  } catch (e) {
    // 서버 예외는 500 유지
    return NextResponse.json(
      { ok: false, error: "Session check failed" },
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
