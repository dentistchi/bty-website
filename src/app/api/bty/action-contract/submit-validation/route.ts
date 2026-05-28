import { NextRequest, NextResponse } from "next/server";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { evaluateActionContractPayload } from "@/lib/bty/validator/runActionContractValidation";
import type { ValidationEvaluationResult } from "@/lib/bty/validator/runActionContractValidation";
import { runAllLayer1Rules } from "@/lib/bty/validator/layer1Rules";
import { normalizePatternFamilyId } from "@/domain/pattern-family";
// MVP-FIX-ACTION-DEMO-05 (B): demo auto-approve must also complete the
// arena_run and award XP. We inline the same 4 calls qr/validate uses in
// its awaitingVerification branch (route.ts L218-259) — kept inline rather
// than extracted so qr/validate's branch stays untouched.
import { completeArenaRunAfterContractVerification } from "@/lib/bty/action-contract/actionContractLifecycle.server";
import { onArenaRunCompleteVerified } from "@/lib/bty/level-engine/arenaLevelRecords";
import {
  applyArenaRunRewardsOnVerifiedCompletion,
  reflectContractVerificationToAir,
} from "@/lib/bty/arena/reflectionRewards.server";

export const runtime = "nodejs";

const MS_72H = 72 * 60 * 60 * 1000;

type Body = {
  contractId?: unknown;
  who?: unknown;
  what?: unknown;
  how?: unknown;
  when?: unknown;
  raw_text?: unknown;
  pattern_state_snapshot?: unknown;
};

/**
 * POST /api/bty/action-contract/submit-validation
 * Step 6 submit → Layer 1 (parallel R1–R6) → Layer 2 if L1 clean.
 * Response: `{ outcome, layer1_errors? }` only — no evaluation rationale (VALIDATOR_ARCHITECTURE_V1 §5).
 */
export async function POST(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";
  const who = typeof body.who === "string" ? body.who : "";
  const what = typeof body.what === "string" ? body.what : "";
  const how = typeof body.how === "string" ? body.how : "";
  const when = typeof body.when === "string" ? body.when : "";
  const rawText = typeof body.raw_text === "string" ? body.raw_text : "";

  if (!contractId) {
    const out = NextResponse.json({ error: "missing_contract_id" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const snapshotProvided = "pattern_state_snapshot" in body;
  const snapshot =
    snapshotProvided && body.pattern_state_snapshot != null && typeof body.pattern_state_snapshot === "object"
      ? (body.pattern_state_snapshot as Record<string, unknown>)
      : null;

  const { data: contract, error: loadErr } = await supabase
    .from("bty_action_contracts")
    .select(
      // MVP-FIX-ACTION-DEMO-05 (B): le_activation_type/weight/chosen_at/
      // deadline_at added to feed the inlined run-completion + AIR reflection
      // calls in the canLegacyAutoApprove (legacy auto-approve) branch.
      "id, user_id, status, pattern_family, arena_scenario_id, session_id, run_id, verification_type, verification_tier, verification_status, details, le_activation_type, weight, chosen_at, deadline_at",
    )
    .eq("id", contractId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) {
    console.error("[submit-validation] contract load failed", {
      contractId,
      userId: user.id,
      message: loadErr.message,
    });
    const out = NextResponse.json(
      { error: "contract_load_failed", message: loadErr.message },
      { status: 500 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (!contract) {
    console.error("[submit-validation] contract_not_found", {
      contractId,
      userId: user.id,
    });
    const out = NextResponse.json(
      { error: "contract_not_found", message: "No action contract for this id and user." },
      { status: 404 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const st = String(contract.status ?? "");
  const scenarioForLog =
    typeof (contract as { arena_scenario_id?: string }).arena_scenario_id === "string"
      ? (contract as { arena_scenario_id: string }).arena_scenario_id
      : "";
  const sessionIdRaw =
    typeof (contract as { session_id?: string }).session_id === "string"
      ? (contract as { session_id: string }).session_id.trim()
      : "";
  let resolvedRunOwner: string | null = null;
  if (sessionIdRaw !== "") {
    const { data: runRow } = await supabase
      .from("arena_runs")
      .select("user_id")
      .eq("run_id", sessionIdRaw)
      .maybeSingle();
    const ru = (runRow as { user_id?: string } | null)?.user_id;
    resolvedRunOwner = typeof ru === "string" && ru.trim() !== "" ? ru.trim() : null;
  }
  const contractUserId = String((contract as { user_id: string }).user_id);
  logActionContractActorTrace("submit_validation", {
    incoming_actor_user_id: user.id,
    source_run_id: sessionIdRaw || null,
    resolved_run_owner_user_id: resolvedRunOwner,
    resolved_auth_user_id: user.id,
    contract_user_id: contractUserId,
  });
  if (resolvedRunOwner != null && resolvedRunOwner !== contractUserId) {
    const out = NextResponse.json(
      { error: "contract_run_user_mismatch", message: "Contract user_id does not match arena_runs.user_id for session_id." },
      { status: 409 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  console.log("[submit-validation] contract loaded", {
    contractId,
    userId: user.id,
    scenarioId: scenarioForLog,
    status: st,
  });

  if (st === "draft") {
    const w = who.trim();
    const x = what.trim();
    const h = how.trim();
    const wh = when.trim();
    if (!w || !x || !h || !wh) {
      const out = NextResponse.json(
        {
          error: "contract_draft_incomplete",
          message: "Fill who, what, how, when or POST /api/action-contracts/:id/commit first.",
        },
        { status: 422 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const committedAt = new Date().toISOString();
    const { error: commitErr } = await supabase
      .from("bty_action_contracts")
      .update({ status: "committed", committed_at: committedAt })
      .eq("id", contractId)
      .eq("user_id", user.id)
      .eq("status", "draft");
    if (commitErr) {
      console.error("[submit-validation] draft→committed failed", commitErr.message);
      const out = NextResponse.json({ error: "commit_transition_failed" }, { status: 500 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  let effectiveStatus = st;
  if (st === "draft") {
    effectiveStatus = "committed";
  }

  // MVP-FIX-ACTION-DEMO-01 (A-3): escalated also allowed for resubmit — works
  // together with B-1 (blocking-fetch surfaces escalated) so users can self-
  // resolve via the validation form instead of waiting on the 72h cron.
  if (
    effectiveStatus !== "pending" &&
    effectiveStatus !== "rejected" &&
    effectiveStatus !== "committed" &&
    effectiveStatus !== "escalated"
  ) {
    const out = NextResponse.json({ error: "contract_not_submittable", status: st }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const patternFamilyNorm = normalizePatternFamilyId(
    typeof contract.pattern_family === "string" ? contract.pattern_family : null,
  );

  const submittedAt = new Date().toISOString();

  const submitPatch: Record<string, unknown> = {
    who: who.trim(),
    what: what.trim(),
    how: how.trim(),
    step_when: when.trim(),
    raw_text: rawText.trim(),
    status: "submitted",
    submitted_at: submittedAt,
  };
  if (snapshotProvided) {
    submitPatch.pattern_state_snapshot = snapshot;
  }

  const { error: upSubmitErr } = await supabase
    .from("bty_action_contracts")
    .update(submitPatch)
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (upSubmitErr) {
    console.error("[submit-validation] update submitted failed", upSubmitErr.message);
    const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // L5+L6 lane (spec v2 §3.5): canonical mvp_open auto-approve REMOVED — QR scan is the
  // sole progression gate. Canonical contracts always run Layer 1 (structural gate) +
  // Layer 2 (advisory; never blocks). The ONLY remaining auto-approve is the
  // legacy_self_attest arm (canLegacyAutoApprove) below, retained for in-flight legacy
  // contracts and staging-gated by the STAB-01 4-AND env terms (BTY_ENV +
  // SELF_REPORT_AUTO_APPROVE). TODO[L8-cleanup]: remove after L8 legacy disposition.
  const verificationType =
    typeof (contract as { verification_type?: unknown }).verification_type === "string"
      ? String((contract as { verification_type?: string }).verification_type)
      : "";
  const verificationTier =
    typeof (contract as { verification_tier?: unknown }).verification_tier === "string"
      ? String((contract as { verification_tier?: string }).verification_tier)
      : "";
  const verificationStatus =
    typeof (contract as { verification_status?: unknown }).verification_status === "string"
      ? String((contract as { verification_status?: string }).verification_status)
      : "";
  const isStagingWorker =
    process.env.BTY_ENV?.trim().toLowerCase() === "staging";
  const envAutoApprove =
    process.env.SELF_REPORT_AUTO_APPROVE === "true";
  // Canonical mvp_open auto-approve REMOVED (spec v2 §3.5(B)): canonical contracts always
  // run the evaluator and land on submitted + validation_approved_at (verified_at null →
  // QR offered → qr/validate scan sets verified_at). Only the legacy_self_attest arm
  // remains, staging-gated by the STAB-01 4-AND env terms.
  // TODO[L8-cleanup]: Remove this entire gate after L8 legacy disposition.
  const canLegacyAutoApprove =
    verificationTier === "legacy_self_attest" &&
    verificationType === "self_attest" &&
    verificationStatus === "pending" &&
    envAutoApprove === true && // STAB-01 4-AND defense (env)
    isStagingWorker === true; // STAB-01 4-AND defense (env)

  const evalResult: ValidationEvaluationResult = canLegacyAutoApprove
    ? (() => {
        const layer1Errors = runAllLayer1Rules({ who, what, how, when, rawText });
        return layer1Errors.length > 0
          ? {
              outcome: "revise" as const,
              layer1Errors,
              layer2Criteria: null,
              modelId: null,
              layer2TechnicalError: null,
            }
          : {
              outcome: "approve" as const,
              layer1Errors: [],
              layer2Criteria: null,
              modelId: null,
              layer2TechnicalError: null,
            };
      })()
    : await evaluateActionContractPayload({
        who,
        what,
        how,
        when,
        rawText,
        patternFamily: patternFamilyNorm,
      });

  const admin = getSupabaseAdmin();

  async function logEvaluation(internalNotes: string | null) {
    if (!admin) return;
    const layer1FailureCount = evalResult.layer1Errors.length;
    const layer2Invoked = layer1FailureCount === 0;
    await admin.from("bty_action_contract_validator_evaluations").insert({
      contract_id: contractId,
      outcome: evalResult.outcome,
      layer1_errors: layer1FailureCount > 0 ? evalResult.layer1Errors : null,
      layer2_criteria: evalResult.layer2Criteria,
      model_id: evalResult.modelId,
      internal_notes: internalNotes,
      layer2_invoked: layer2Invoked,
      layer1_failure_count: layer1FailureCount,
    });
  }

  if (evalResult.outcome === "revise") {
    const { error: revErr } = await supabase
      .from("bty_action_contracts")
      .update({ status: "pending" })
      .eq("id", contractId)
      .eq("user_id", user.id);

    if (revErr) {
      console.error("[submit-validation] revise rollback failed", revErr.message);
    }
    await logEvaluation(null);
    const out = NextResponse.json({
      outcome: "revise",
      layer1_errors: evalResult.layer1Errors,
    });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // verificationType / canLegacyAutoApprove are computed earlier and remain in scope here.
  const nowIso = new Date().toISOString();

  // Layer 2 is ADVISORY (spec v2 §3.5(C), X-2). The `revise` outcome (Layer 1 structural
  // gate) already returned above. The remaining outcomes — approve / escalate / reject —
  // all converge on the SAME progression class: canonical contracts land on
  // `submitted` + validation_approved_at (verified_at null → QR offered → qr/validate scan
  // is the sole verified_at setter), and the legacy auto-approve path (canLegacyAutoApprove)
  // still completes terminally inline. The Layer 2 verdict differs only as semantic
  // confidence (approve→high / escalate→medium / reject→low). That is validation metadata
  // captured by the existing `outcome` column in bty_action_contract_validator_evaluations
  // (logEvaluation). It is NOT written to le_verification_log here — no verification event
  // occurs at submit time (spec D1); the scan-side carry-through to
  // le_verification_log.verification_confidence is qr/validate's responsibility.
  const layer2SemanticConfidence: "high" | "medium" | "low" =
    evalResult.outcome === "approve" ? "high" : evalResult.outcome === "escalate" ? "medium" : "low";

  const approvePatch: Record<string, unknown> = canLegacyAutoApprove
    ? {
        status: "approved",
        validation_approved_at: nowIso,
        verified_at: nowIso,
        completed_at: nowIso,
        escalated_at: null,
      }
    : {
        // Canonical: evidence submission lands ACTION_SUBMITTED. QR scan (qr/validate) is the
        // sole verified_at setter; the Layer 2 verdict is advisory and never blocks progression.
        status: "submitted",
        validation_approved_at: nowIso,
        escalated_at: null,
      };
  console.log("[submit-validation] advisory landing payload", {
    contractId,
    userId: user.id,
    verificationType,
    outcome: evalResult.outcome,
    layer2SemanticConfidence,
    legacyAutoApprove: canLegacyAutoApprove,
    patch: approvePatch,
  });
  logActionContractActorTrace("approve_action_contract", {
    incoming_actor_user_id: user.id,
    source_run_id: sessionIdRaw || null,
    resolved_run_owner_user_id: resolvedRunOwner,
    resolved_auth_user_id: user.id,
    contract_user_id: contractUserId,
    inserted_bty_action_contracts_user_id: contractUserId,
  });

  const { error: apErr } = await supabase
    .from("bty_action_contracts")
    .update(approvePatch)
    .eq("id", contractId)
    .eq("user_id", user.id);
  if (apErr) {
    console.error("[submit-validation] advisory landing transition failed", {
      contractId,
      userId: user.id,
      message: apErr.message,
      code: (apErr as { code?: string }).code,
      details: (apErr as { details?: string }).details,
      hint: (apErr as { hint?: string }).hint,
    });
    const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // Backfill run_id for older rows (session_id is the arena run id) so qr/validate can
  // resolve the run; execution verification + run DONE happen in qr/validate.
  if (admin && sessionIdRaw !== "") {
    const hasRunId =
      contract != null &&
      typeof (contract as { run_id?: string | null }).run_id === "string" &&
      String((contract as { run_id?: string | null }).run_id).trim() !== "";
    if (!hasRunId) {
      const { error: ridErr } = await admin
        .from("bty_action_contracts")
        .update({ run_id: sessionIdRaw })
        .eq("id", contractId)
        .eq("user_id", user.id);
      if (ridErr) {
        console.warn("[submit-validation] run_id backfill skipped", ridErr.message);
      }
    }
  }

  // Legacy auto-approve completes the arena_run + awards XP inline (mirrors qr/validate's
  // awaitingVerification branch, route.ts L187-228; INVARIANT 3). Canonical contracts do
  // NOT complete here — qr/validate (scan) is the sole completion path (spec v2 §3.5(B)).
  if (canLegacyAutoApprove) {
    const c = contract as Record<string, unknown>;
    const runIdFromContract =
      typeof c.run_id === "string" && c.run_id.trim() !== "" ? c.run_id.trim() : "";
    const sessionIdFromContract =
      typeof c.session_id === "string" && c.session_id.trim() !== ""
        ? c.session_id.trim()
        : "";
    const resolvedRunId =
      runIdFromContract || sessionIdFromContract || sessionIdRaw || null;

    if (admin && resolvedRunId) {
      const finalized = await completeArenaRunAfterContractVerification(admin, {
        userId: user.id,
        runId: resolvedRunId,
        verifiedAtIso: nowIso,
      });
      if (!finalized.runUpdated) {
        console.error(
          "[submit-validation] arena_runs completion after contract verify failed",
        );
      }

      const levelRes = await onArenaRunCompleteVerified(admin, user.id);
      if (!levelRes.ok) {
        console.error("[submit-validation] level record update failed", levelRes.error);
      }

      const reward = await applyArenaRunRewardsOnVerifiedCompletion({
        supabase: admin,
        userId: user.id,
        run: {
          run_id: resolvedRunId,
          scenario_id:
            typeof c.arena_scenario_id === "string" ? c.arena_scenario_id : null,
        },
      });
      if (!reward.ok) {
        console.error("[submit-validation] deferred run reward apply failed", reward.error);
      }

      const airReflection = await reflectContractVerificationToAir({
        supabase: admin,
        userId: user.id,
        runId: resolvedRunId,
        verifiedAtIso: nowIso,
        activationType:
          typeof c.le_activation_type === "string" ? c.le_activation_type : null,
        weight: typeof c.weight === "number" ? c.weight : null,
        chosenAtIso: typeof c.chosen_at === "string" ? c.chosen_at : null,
        dueAtIso: typeof c.deadline_at === "string" ? c.deadline_at : null,
      });
      if (!airReflection.ok) {
        console.error("[submit-validation] AIR reflection failed", airReflection.error);
      }
    } else {
      console.error(
        "[submit-validation] legacy auto-approve run completion skipped — admin or runId missing",
        { hasAdmin: !!admin, resolvedRunId },
      );
    }
  }

  // escalate keeps an audit escalation row (Q2: advisory record, no longer a blocking
  // dead-end). The contract status stays `submitted` above — this row is informational
  // (valuable for the future X-3 content gate), not a progression block.
  if (evalResult.outcome === "escalate" && admin) {
    const expiresAt = new Date(Date.now() + MS_72H).toISOString();
    const { error: escInsErr } = await admin.from("bty_action_contract_escalations").insert({
      contract_id: contractId,
      user_id: user.id,
      expires_at: expiresAt,
      status: "open",
    });
    if (escInsErr) {
      console.error("[submit-validation] escalation row failed", escInsErr.message);
    }
  }

  // Layer 2 technical failure (escalate path) is preserved as internal_notes; other
  // outcomes pass null. Semantic confidence is captured by `outcome` in validator_evaluations.
  await logEvaluation(evalResult.outcome === "escalate" ? evalResult.layer2TechnicalError : null);

  // Response stays minimal (VALIDATOR_ARCHITECTURE_V1 §5 — no rationale leakage): outcome +
  // flow-control fields only. The Layer 2 semantic confidence is NOT exposed here — it is
  // server-side validation metadata, captured via `outcome` in validator_evaluations.
  const out = NextResponse.json({
    outcome: evalResult.outcome,
    contract_state: canLegacyAutoApprove ? "terminal" : "awaiting_qr",
    verified_at: canLegacyAutoApprove ? nowIso : null,
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
