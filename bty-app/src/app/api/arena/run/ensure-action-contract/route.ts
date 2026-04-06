import { NextRequest, NextResponse } from "next/server";
import { arenaRunIdFromUnknown } from "@/domain/arena/scenarios";
import { ensureActionContractForArenaRun } from "@/lib/bty/action-contract/ensureActionContractForArenaRun";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { resolvePatternFamilyForContractTrigger } from "@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger";
import { syncPatternStatesForUser } from "@/lib/bty/pattern-engine/syncPatternStates";

export const runtime = "nodejs";

/**
 * POST /api/arena/run/ensure-action-contract
 * Ensures a `bty_action_contracts` row for an in-flight Arena run (Step 6 prerequisite), without completing the run.
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
    .select("run_id, scenario_id, status")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const status = String((row as { status?: string }).status ?? "");
  if (status === "DONE" || status === "ABANDONED") {
    return NextResponse.json({ error: "RUN_NOT_ACTIVE" }, { status: 409 });
  }

  const scenarioId = String((row as { scenario_id?: string }).scenario_id ?? "");

  await syncPatternStatesForUser(supabase, user.id);
  const patternFamily = await resolvePatternFamilyForContractTrigger(supabase, user.id);

  const ensured = await ensureActionContractForArenaRun({
    userId: user.id,
    runId,
    scenarioId: scenarioId || "unknown",
    nbaLogId: null,
    patternFamily,
  });

  if (!ensured.ok || !ensured.contractId) {
    return NextResponse.json(
      { error: "contract_ensure_failed", contractId: ensured.contractId },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    contractId: ensured.contractId,
    created: ensured.created,
  });
}
