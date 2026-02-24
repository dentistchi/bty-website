import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";

export const dynamic = "force-dynamic";

/**
 * GET: active league (30-day window). Creates one if none.
 * Used by leaderboard, weekly-xp, run/complete.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const league = await getActiveLeague(supabase, admin);
  if (!league) {
    return NextResponse.json(
      { error: "ACTIVE_LEAGUE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    league_id: league.league_id,
    start_at: league.start_at,
    end_at: league.end_at,
    name: league.name ?? null,
  });
}
