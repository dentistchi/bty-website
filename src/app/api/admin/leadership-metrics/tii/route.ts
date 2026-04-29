import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export type TeamTIIRow = {
  teamId: string;
  leagueName: string | null;
  tii: number | null;
  avgAir: number | null;
  avgMwd: number | null;
  tsp: number | null;
  weekStart: string | null;
  memberCount: number;
};

export type TIIMetricsResponse = {
  rows: TeamTIIRow[];
  computedAt: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  try {
    // Latest snapshot per team from team_weekly_metrics
    const { data: metrics, error: metricsErr } = await supabase
      .from("team_weekly_metrics")
      .select("team_id, tii, avg_air, avg_mwd, tsp, week_start")
      .order("week_start", { ascending: false });

    if (metricsErr) return NextResponse.json({ error: metricsErr.message }, { status: 500 });

    // One row per team: pick the latest week
    const latestByTeam = new Map<string, (typeof metrics)[0]>();
    for (const row of metrics ?? []) {
      if (!latestByTeam.has(row.team_id)) latestByTeam.set(row.team_id, row);
    }

    // League names
    const { data: leagues } = await supabase
      .from("arena_leagues")
      .select("league_id, name");
    const leagueNameMap = new Map<string, string>(
      (leagues ?? []).map((l) => [l.league_id, l.name ?? l.league_id]),
    );

    // Member counts per league
    const { data: members } = await supabase
      .from("league_memberships")
      .select("league_id")
      .eq("status", "active");
    const memberCountMap = new Map<string, number>();
    for (const m of members ?? []) {
      memberCountMap.set(m.league_id, (memberCountMap.get(m.league_id) ?? 0) + 1);
    }

    const rows: TeamTIIRow[] = [...latestByTeam.entries()].map(([teamId, row]) => ({
      teamId,
      leagueName: leagueNameMap.get(teamId) ?? null,
      tii: row.tii != null ? Number(row.tii) : null,
      avgAir: row.avg_air != null ? Number(row.avg_air) : null,
      avgMwd: row.avg_mwd != null ? Number(row.avg_mwd) : null,
      tsp: row.tsp != null ? Number(row.tsp) : null,
      weekStart: row.week_start ?? null,
      memberCount: memberCountMap.get(teamId) ?? 0,
    }));

    rows.sort((a, b) => (b.tii ?? 0) - (a.tii ?? 0));

    return NextResponse.json({ rows, computedAt: new Date().toISOString() } satisfies TIIMetricsResponse);
  } catch (err: unknown) {
    console.error("[admin/leadership-metrics/tii] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch TII data" },
      { status: 500 },
    );
  }
}
