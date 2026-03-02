import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getActiveLeague } from "@/lib/bty/arena/activeLeague";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/arena/leadership-engine/tii
 * Returns team TII for the user's active league (team_id = league_id). Team score only; individual AIR not exposed.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  const league = await getActiveLeague(supabase, admin);
  if (!league) {
    const res = NextResponse.json({ tii: null, avg_air: null, avg_mwd: null, tsp: null });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const db = admin ?? supabase;
  const { data: row } = await db
    .from("team_weekly_metrics")
    .select("tii, avg_air, avg_mwd, tsp")
    .eq("team_id", league.league_id)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    const res = NextResponse.json({ tii: null, avg_air: null, avg_mwd: null, tsp: null });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const res = NextResponse.json({
    tii: Number(row.tii),
    avg_air: Number(row.avg_air),
    avg_mwd: Number(row.avg_mwd),
    tsp: Number(row.tsp),
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
