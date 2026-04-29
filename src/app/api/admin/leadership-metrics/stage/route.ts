import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export type UserStageRow = {
  userId: string;
  email: string;
  stage: number;
  stageLabel: string;
  stageEnteredAt: string | null;
  daysInStage: number;
  forcedReset: boolean;
  isLeaderTrack: boolean;
};

export type StageMetricsResponse = {
  rows: UserStageRow[];
  distribution: Record<number, number>;
  computedAt: string;
};

const STAGE_LABELS: Record<number, string> = {
  1: "Exploring",
  2: "Growing",
  3: "Established",
  4: "Mastering",
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  try {
    const { data: states, error: stateErr } = await supabase
      .from("leadership_engine_state")
      .select("user_id, current_stage, stage_entered_at, forced_reset_triggered_at, is_leader_track")
      .order("current_stage", { ascending: false });

    if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
    const emailMap = new Map<string, string>(
      (authData.users ?? []).map((u) => [u.id, u.email ?? u.id]),
    );

    const now = Date.now();
    const rows: UserStageRow[] = (states ?? []).map((s) => {
      const enteredAt = s.stage_entered_at ? new Date(s.stage_entered_at).getTime() : null;
      const daysInStage = enteredAt ? Math.floor((now - enteredAt) / 86_400_000) : 0;
      return {
        userId: s.user_id,
        email: emailMap.get(s.user_id) ?? s.user_id,
        stage: s.current_stage ?? 1,
        stageLabel: STAGE_LABELS[s.current_stage ?? 1] ?? `Stage ${s.current_stage}`,
        stageEnteredAt: s.stage_entered_at ?? null,
        daysInStage,
        forcedReset: s.forced_reset_triggered_at != null,
        isLeaderTrack: s.is_leader_track === true,
      };
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const r of rows) {
      distribution[r.stage] = (distribution[r.stage] ?? 0) + 1;
    }

    return NextResponse.json({ rows, distribution, computedAt: new Date().toISOString() } satisfies StageMetricsResponse);
  } catch (err: unknown) {
    console.error("[admin/leadership-metrics/stage] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch stage data" },
      { status: 500 },
    );
  }
}
