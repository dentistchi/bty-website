import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const dynamic = "force-dynamic";

/** Start of today in UTC (00:00:00.000Z) */
function startOfTodayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * GET: Sum of XP from arena_events for the current user where created_at is today (UTC).
 * Used by dashboard "Points today".
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const since = startOfTodayUTC();

  const { data: rows, error } = await supabase
    .from("arena_events")
    .select("xp")
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const xpToday = (rows ?? []).reduce((sum, r) => sum + (Number(r.xp) || 0), 0);

  return NextResponse.json({ xpToday });
}
