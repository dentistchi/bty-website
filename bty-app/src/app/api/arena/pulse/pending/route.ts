import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  computePendingPulseRun,
  type DoneRunRef,
} from "@/lib/bty/leadership-engine/pending-pulse";

/**
 * GET /api/arena/pulse/pending — Strategy B surface-agnostic pulse capture.
 * Returns the most-recent DONE run (within recent window) lacking a le_pulse_log
 * row → the run to prompt for. Server absence is the dedup. user-session client.
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: doneRows, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, completed_at")
    .eq("user_id", user.id)
    .eq("status", "DONE")
    .order("completed_at", { ascending: false })
    .limit(5);
  if (runErr) {
    return NextResponse.json({ error: runErr.message }, { status: 500 });
  }

  const { data: pulseRows, error: pulseErr } = await supabase
    .from("le_pulse_log")
    .select("session_id")
    .eq("user_id", user.id);
  if (pulseErr) {
    return NextResponse.json({ error: pulseErr.message }, { status: 500 });
  }

  const pulsedRunIds = new Set(
    (pulseRows ?? [])
      .map((r) => (r as { session_id: string | null }).session_id)
      .filter((s): s is string => typeof s === "string"),
  );
  const doneRunsDesc: DoneRunRef[] = (doneRows ?? []).map((r) => ({
    run_id: (r as { run_id: string }).run_id,
    completed_at: (r as { completed_at: string | null }).completed_at,
  }));

  const pendingPulseRunId = computePendingPulseRun(doneRunsDesc, pulsedRunIds);
  return NextResponse.json({ pendingPulseRunId });
}
