import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getWeekStartUTC, REFLECTION_QUEST_TARGET } from "@/lib/bty/arena/weeklyQuest";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const weekStart = getWeekStartUTC();
  const weekStartISO = `${weekStart}T00:00:00.000Z`;

  const { count: reflectionCount, error: countErr } = await supabase
    .from("arena_events")
    .select("event_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("event_type", ["REFLECTION_SELECTED", "BEGINNER_REFLECTION"])
    .gte("created_at", weekStartISO);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  const { data: claim, error: claimErr } = await supabase
    .from("arena_weekly_quest_claims")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .eq("quest_type", "reflection")
    .maybeSingle();

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });

  return NextResponse.json({
    reflectionCount: reflectionCount ?? 0,
    reflectionTarget: REFLECTION_QUEST_TARGET,
    reflectionQuestClaimed: !!claim,
    weekStartISO: weekStartISO,
    weekMaxDailyXp,
  });
}
