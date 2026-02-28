import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/**
 * GET: 현재 로그인 사용자의 weekly_xp(league_id null) 행 여부와 xp_total.
 * 리더보드에 안 나올 때 "저장된 주간 XP 없음" vs "있음" 진단용.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("weekly_xp")
    .select("xp_total, updated_at")
    .eq("user_id", user.id)
    .is("league_id", null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    hasWeeklyXpRow: !!row,
    xpTotal: row?.xp_total ?? 0,
    updatedAt: row?.updated_at ?? null,
  });
}
