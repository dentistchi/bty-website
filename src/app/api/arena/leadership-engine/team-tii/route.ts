import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getTeamTIISnapshot } from "@/engine/integrity/tii-calculator.service";

/**
 * GET /api/arena/leadership-engine/team-tii?teamId=
 * Team TII from `team_integrity_index` (same source as `getTeamTII` / `getTeamTIISnapshot`).
 * Caller must be a member of the league (`league_id` = teamId). Team-level only; no per-member AIR.
 *
 * Response (200): { tii, avg_air, avg_mwd, tsp, last_calculated_at, member_count }
 * Null metrics when no snapshot yet. Errors: 400 MISSING_TEAM_ID · 401 · 403 FORBIDDEN · 503 ADMIN_UNAVAILABLE · 500.
 */
export async function GET(req: NextRequest) {
  const { user, supabase, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const teamId = req.nextUrl.searchParams.get("teamId")?.trim() ?? "";
  if (!teamId) {
    return NextResponse.json({ error: "MISSING_TEAM_ID" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("league_memberships")
    .select("league_id")
    .eq("league_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    const res = NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  }

  const { count: memberCount, error: countErr } = await supabase
    .from("league_memberships")
    .select("*", { count: "exact", head: true })
    .eq("league_id", teamId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  let snapshot: Awaited<ReturnType<typeof getTeamTIISnapshot>> = null;
  try {
    snapshot = await getTeamTIISnapshot(teamId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Supabase service role not configured")) {
      return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const res = NextResponse.json({
    tii: snapshot?.tii ?? null,
    avg_air: snapshot?.avg_air ?? null,
    avg_mwd: snapshot?.avg_mwd ?? null,
    tsp: snapshot?.tsp ?? null,
    last_calculated_at: snapshot?.calculated_at ?? null,
    member_count: memberCount ?? 0,
  });
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
