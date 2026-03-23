import { NextRequest, NextResponse } from "next/server";
import { getTeamBenchmark } from "@/engine/integrity/team-air-benchmark.service";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";

/**
 * GET /api/arena/leadership-engine/team-benchmark?teamId=
 * Team benchmark (rolling weeks, risk); peer percentile for the caller only.
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

  try {
    const b = await getTeamBenchmark(teamId);
    const mine = b.peerPercentiles.find((p) => p.userId === user.id);
    const res = NextResponse.json({
      teamId: b.teamId,
      computedAt: b.computedAt,
      weeks: b.weeks,
      teamIntegrityRisk: b.teamIntegrityRisk,
      consecutiveLowTiiWeeks: b.consecutiveLowTiiWeeks,
      riskLevel: b.riskLevel,
      myPeerPercentile: mine?.peerPercentile ?? null,
      myAir14d: mine?.air14d ?? null,
    });
    copyCookiesAndDebug(base, res, req, true);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Supabase service role not configured")) {
      return NextResponse.json({ error: "ADMIN_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
