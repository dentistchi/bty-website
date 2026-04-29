import { NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { applyStep7AbandonLevelEffects } from "@/lib/bty/level-engine/arenaLevelRecords";

export const runtime = "nodejs";

/**
 * POST /api/arena/run/step7-abandon — Step 7 execution gate abandoned without verification (`locked_step7_abandoned`).
 * Resets consecutive verified streak; updates abandon counters; may apply level decrease (ENGINE §5).
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const runId = arenaRunIdFromUnknown((body as { runId?: unknown }).runId);
  if (runId === null) {
    return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });
  }

  const { data: row, error: selErr } = await supabase
    .from("arena_runs")
    .select("run_id, status, current_step, meta")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const status = String((row as { status?: string }).status ?? "");
  if (status === "DONE" || status === "ABANDONED") {
    return NextResponse.json({ error: "RUN_NOT_ACTIVE" }, { status: 409 });
  }

  const step = Number((row as { current_step?: unknown }).current_step ?? 0);
  if (!Number.isFinite(step) || step < 7) {
    return NextResponse.json({ error: "STEP7_REQUIRED" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const meta = (row as { meta?: Record<string, unknown> | null }).meta;
  const nextMeta =
    meta != null && typeof meta === "object"
      ? { ...meta, abandoned_at: nowIso }
      : { abandoned_at: nowIso };

  const { error: updErr } = await supabase
    .from("arena_runs")
    .update({
      status: "ABANDONED",
      completion_state: "locked_step7_abandoned",
      completed_at: nowIso,
      meta: nextMeta,
    })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[step7-abandon] getSupabaseAdmin() null — level record not updated", {
      userId: user.id,
      runId,
    });
    return NextResponse.json({ ok: true, runId, levelRecordUpdated: false });
  }

  const levelRes = await applyStep7AbandonLevelEffects(admin, user.id, runId);
  if (!levelRes.ok) {
    console.error("[step7-abandon] applyStep7AbandonLevelEffects failed", levelRes.error);
  }

  return NextResponse.json({
    ok: true,
    runId,
    bandDecreased: levelRes.bandDecreased === true,
    levelRecordUpdated: levelRes.ok,
  });
}
