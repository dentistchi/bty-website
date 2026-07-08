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

  const { data: weekEvents } = await supabase
    .from("arena_events")
    .select("xp, created_at")
    .eq("user_id", user.id)
    .gte("created_at", weekStartISO);

  const dailySums: Record<string, number> = {};
  for (const row of weekEvents ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    dailySums[day] = (dailySums[day] ?? 0) + (typeof row.xp === "number" ? row.xp : 0);
  }

  // Build the 7-day display window (ending "today" UTC), then project each day to a 0–5
  // relative visual intensity. Raw XP never leaves the server: the response carries only
  // barIntensity — a presentation shape (0 = no activity, 5 = highest day in the window) —
  // not a score, rank, or metric. seriesMax is derived from the display window only and is
  // never emitted (emitting it would let a known anchor reconstruct absolute XP).
  const windowDays: Array<{ date: string; xp: number }> = [];
  const todayUtc = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayUtc);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    windowDays.push({ date: key, xp: dailySums[key] ?? 0 });
  }
  const seriesMax = windowDays.reduce((max, day) => (day.xp > max ? day.xp : max), 0);
  const dailyBarSeries = windowDays.map(({ date, xp }) => {
    const barIntensity =
      seriesMax > 0 && xp > 0 ? Math.max(1, Math.floor((xp / seriesMax) * 5)) : 0;
    return { date, barIntensity };
  });

  return NextResponse.json({
    reflectionCount: reflectionCount ?? 0,
    reflectionTarget: REFLECTION_QUEST_TARGET,
    reflectionQuestClaimed: !!claim,
    weekStartISO: weekStartISO,
    dailyBarSeries,
  });
}
