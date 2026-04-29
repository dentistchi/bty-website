import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const runtime = "nodejs";

/**
 * POST /api/arena/run/step5-acknowledge
 * UX_FLOW_LOCK_V1 §2 Step 5 — sets `acknowledgment_timestamp` only on explicit activation (idempotent if already set).
 */
export async function POST(req: NextRequest) {
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

  const runIdRaw =
    typeof body === "object" && body !== null && "runId" in body
      ? (body as { runId?: unknown }).runId
      : undefined;
  const runId = arenaRunIdFromUnknown(typeof runIdRaw === "string" ? runIdRaw : "");
  if (runId === null) {
    return NextResponse.json({ error: "MISSING_RUN_ID" }, { status: 400 });
  }

  const { data: row, error: selErr } = await supabase
    .from("arena_runs")
    .select("run_id, acknowledgment_timestamp, scenario_id, status")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const scenarioId = String((row as { scenario_id?: string }).scenario_id ?? "unknown");
  const existingAck = (row as { acknowledgment_timestamp?: string | null }).acknowledgment_timestamp;
  if (existingAck != null && String(existingAck).trim() !== "") {
    return NextResponse.json({
      ok: true,
      acknowledgment_timestamp: existingAck,
      idempotent: true,
    });
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("arena_runs")
    .update({ acknowledgment_timestamp: nowIso, current_step: 5 })
    .eq("run_id", runId)
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("arena_events").insert({
    user_id: user.id,
    run_id: runId,
    step: 5,
    event_type: "MIRROR_CONTINUE",
    scenario_id: scenarioId,
    xp: 0,
    meta: { acknowledged_at: nowIso },
  });

  return NextResponse.json({
    ok: true,
    acknowledgment_timestamp: nowIso,
  });
}
