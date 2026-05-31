import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  // 앱 표준 SSR client로 쿠키 세션 해석 (chunked sb-*-auth-token 포함; 수동 파서 미사용)
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const day = Number(body?.day);
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return NextResponse.json({ ok: false, error: "invalid day" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 503 });
  }

  await admin.from("train_day_completions").upsert({
    user_id: user.id,
    day,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
