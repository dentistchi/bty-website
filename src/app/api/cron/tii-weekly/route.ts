import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { compute_team_tii } from "@/lib/bty/leadership-engine/tii-service";
import { getTeamIds, buildGetTeamTIIInputs } from "@/lib/bty/leadership-engine/tii-weekly-inputs";

/**
 * POST /api/cron/tii-weekly
 * Runs weekly TII recomputation per docs/TII_WEEKLY_JOB_SPEC.md.
 * Inserts into team_weekly_metrics (idempotent: ON CONFLICT DO NOTHING).
 * Secured by CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
 */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret")?.trim();
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfiguration (no admin client)" }, { status: 500 });
  }

  const weekStart = getWeekStartMondayUTC();
  const teamIds = await getTeamIds(admin);
  const getInputs = buildGetTeamTIIInputs(admin, weekStart);

  let inserted = 0;
  let skipped = 0;
  for (const teamId of teamIds) {
    try {
      const result = await compute_team_tii(teamId, getInputs, weekStart);
      const { error } = await admin.from("team_weekly_metrics").insert({
        team_id: teamId,
        week_start: weekStart,
        tii: result.tii,
        avg_air: result.avg_air,
        avg_mwd: result.avg_mwd,
        tsp: result.tsp,
      });
      if (error) {
        if (error.code === "23505") skipped += 1; // unique violation = already exists
        else throw error;
      } else {
        inserted += 1;
      }
    } catch (e) {
      console.error("[tii-weekly] team", teamId, e);
    }
  }

  return NextResponse.json({
    ok: true,
    week_start: weekStart,
    teams: teamIds.length,
    inserted,
    skipped,
  });
}

/** Returns current week's Monday in YYYY-MM-DD (UTC). */
function getWeekStartMondayUTC(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}
