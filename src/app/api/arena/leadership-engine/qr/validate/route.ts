import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { completeArenaRunAfterContractVerification } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import { verifyArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";
import { onArenaRunCompleteVerified } from "@/lib/bty/level-engine/arenaLevelRecords";
import {
  applyArenaRunRewardsOnVerifiedCompletion,
  reflectContractVerificationToAir,
} from "@/lib/bty/arena/reflectionRewards.server";

export const runtime = "nodejs";

/**
 * POST /api/arena/leadership-engine/qr/validate
 * Body: { arenaActionLoopToken: string, clientScanAtIso?: string }
 *
 * Witness / any caller may POST — **no** `requireUser`. The token’s **`userId`** must equal **`arena_runs.user_id`** for **`sessionId`** (run id); otherwise **409** `run_actor_token_mismatch`. DB updates use service role keyed by verified token payload.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const arenaActionLoopToken =
    typeof body.arenaActionLoopToken === "string" ? body.arenaActionLoopToken.trim() : "";
  if (!arenaActionLoopToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const verified = verifyArenaActionLoopToken(arenaActionLoopToken);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }

  const { userId, sessionId, contractId } = verified.payload;
  if (!contractId || contractId.trim() === "") {
    console.warn("[qr/validate] token missing contractId; refusing no-op success", {
      userId,
      sessionId,
    });
    return NextResponse.json({ ok: false, error: "missing_contract_id" }, { status: 422 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  let runOwnerId: string | null = null;
  const tokenSessionLooksLikeContractRef = sessionId.startsWith("contract:");
  if (supabaseUrl.trim() && serviceKey.trim() && !tokenSessionLooksLikeContractRef) {
    const adminForActor = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: runActorRow } = await adminForActor
      .from("arena_runs")
      .select("user_id")
      .eq("run_id", sessionId)
      .maybeSingle();
    const uid = (runActorRow as { user_id?: string } | null)?.user_id;
    runOwnerId = typeof uid === "string" && uid.trim() !== "" ? uid.trim() : null;
  }

  logActionContractActorTrace("qr_validate", {
    incoming_actor_user_id: userId,
    source_run_id: sessionId,
    resolved_run_owner_user_id: runOwnerId,
    contract_user_id: contractId ?? null,
  });
  if (runOwnerId != null && runOwnerId !== userId) {
    return NextResponse.json({ ok: false, error: "run_actor_token_mismatch" }, { status: 409 });
  }

  if (!supabaseUrl.trim() || !serviceKey.trim()) {
    console.error("[qr/validate] Missing Supabase admin credentials");
    return NextResponse.json({ error: "server_config_error" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: row, error: selErr } = await adminClient
    .from("bty_action_contracts")
    .select(
      "id, user_id, session_id, run_id, arena_scenario_id, status, validation_approved_at, verified_at, le_activation_type, weight, chosen_at, deadline_at",
    )
    .eq("id", contractId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr || !row) {
    return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 409 });
  }

  const pendingForCommit =
    row.status === "pending" &&
    row.validation_approved_at == null &&
    row.verified_at == null;
  const submittedAwaitingApproval =
    row.status === "submitted" &&
    row.validation_approved_at == null &&
    row.verified_at == null;
  const awaitingVerification =
    (row.status === "approved" || row.status === "submitted") &&
    row.validation_approved_at != null &&
    row.verified_at == null;
  console.info("[qr/validate] contract status before transition", {
    contractId,
    status: row.status,
    pendingForCommit,
    submittedAwaitingApproval,
    awaitingVerification,
  });

  const resolvedRunId =
    (typeof row.run_id === "string" && row.run_id.trim() !== "" ? row.run_id.trim() : "") ||
    (typeof row.session_id === "string" && row.session_id.trim() !== "" ? row.session_id.trim() : "") ||
    (tokenSessionLooksLikeContractRef ? "" : sessionId.trim()) ||
    null;

  if (runOwnerId == null && resolvedRunId && supabaseUrl.trim() && serviceKey.trim()) {
    const adminForActor = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: runActorRow } = await adminForActor
      .from("arena_runs")
      .select("user_id")
      .eq("run_id", resolvedRunId)
      .maybeSingle();
    const uid = (runActorRow as { user_id?: string } | null)?.user_id;
    runOwnerId = typeof uid === "string" && uid.trim() !== "" ? uid.trim() : null;
    if (runOwnerId != null && runOwnerId !== userId) {
      return NextResponse.json({ ok: false, error: "run_actor_token_mismatch" }, { status: 409 });
    }
  }

  if (pendingForCommit) {
    const submittedAt = new Date().toISOString();
    const { data: updated, error: upErr } = await adminClient
      .from("bty_action_contracts")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
      })
      .eq("id", contractId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id, status, submitted_at, verified_at")
      .maybeSingle();

    if (upErr || !updated || updated.status !== "submitted") {
      console.error("[qr/validate] pending->submitted transition failed", {
        contractId,
        error: upErr?.message ?? null,
        updatedStatus: updated?.status ?? null,
      });
      return NextResponse.json({ ok: false, error: "contract_update_failed" }, { status: 500 });
    }
    console.info("[qr/validate] pending->submitted transition complete", {
      contractId,
      finalStatus: updated.status,
      submittedAt: updated.submitted_at ?? null,
    });

    return NextResponse.json({
      ok: true,
      userId,
      sessionId: resolvedRunId,
      contractId,
      status: "submitted",
      runtime_state: "NEXT_SCENARIO_READY",
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      clientScanAtIso: typeof body.clientScanAtIso === "string" ? body.clientScanAtIso : null,
    });
  }

  if (!submittedAwaitingApproval && !awaitingVerification) {
    return NextResponse.json({ ok: false, error: "contract_not_pending" }, { status: 409 });
  }

  if (submittedAwaitingApproval) {
    return NextResponse.json({
      ok: true,
      userId,
      sessionId: resolvedRunId,
      contractId,
      status: "submitted",
      runtime_state: "NEXT_SCENARIO_READY",
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      clientScanAtIso: typeof body.clientScanAtIso === "string" ? body.clientScanAtIso : null,
    });
  }

  const verifiedAt = new Date().toISOString();
  const { error: upErr } = await adminClient
    .from("bty_action_contracts")
    .update({
      status: "approved",
      verified_at: verifiedAt,
      completed_at: verifiedAt,
    })
    .eq("id", contractId)
    .eq("user_id", userId)
    .in("status", ["approved", "submitted"])
    .not("validation_approved_at", "is", null)
    .is("verified_at", null);

  if (upErr) {
    return NextResponse.json({ ok: false, error: "contract_update_failed" }, { status: 500 });
  }

  const finalized = await completeArenaRunAfterContractVerification(adminClient, {
    userId,
    runId: resolvedRunId ?? sessionId,
    verifiedAtIso: verifiedAt,
  });
  if (!finalized.runUpdated) {
    console.error("[qr/validate] arena_runs completion after contract verify failed");
  }

  const levelRes = await onArenaRunCompleteVerified(adminClient, userId);
  if (!levelRes.ok) {
    console.error("[qr/validate] level record update failed", levelRes.error);
  }

  const runIdForReward =
    resolvedRunId ?? sessionId;
  const reward = await applyArenaRunRewardsOnVerifiedCompletion({
    supabase: adminClient,
    userId,
    run: {
      run_id: runIdForReward,
      scenario_id:
        typeof row.arena_scenario_id === "string" ? row.arena_scenario_id : null,
    },
  });
  if (!reward.ok) {
    console.error("[qr/validate] deferred run reward apply failed", reward.error);
  }
  const airReflection = await reflectContractVerificationToAir({
    supabase: adminClient,
    userId,
    runId: runIdForReward,
    verifiedAtIso: verifiedAt,
    activationType:
      typeof row.le_activation_type === "string" ? row.le_activation_type : null,
    weight: typeof row.weight === "number" ? row.weight : null,
    chosenAtIso: typeof row.chosen_at === "string" ? row.chosen_at : null,
    dueAtIso: typeof row.deadline_at === "string" ? row.deadline_at : null,
  });
  if (!airReflection.ok) {
    console.error("[qr/validate] AIR reflection failed", airReflection.error);
  }

  return NextResponse.json({
    ok: true,
    userId,
    sessionId,
    contractId,
    clientScanAtIso: typeof body.clientScanAtIso === "string" ? body.clientScanAtIso : null,
  });
}
