import { NextRequest, NextResponse } from "next/server";
import { logActionContractActorTrace } from "@/lib/bty/action-contract/arenaRunActor.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { evaluateActionContractPayload } from "@/lib/bty/validator/runActionContractValidation";
import { normalizePatternFamilyId } from "@/domain/pattern-family";

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
      "id, user_id, status, pattern_family, arena_scenario_id, session_id, run_id, verification_type, details",
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

  if (effectiveStatus !== "pending" && effectiveStatus !== "rejected" && effectiveStatus !== "committed") {
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

  const evalResult = await evaluateActionContractPayload({
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

  const nowIso = new Date().toISOString();
  const verificationType =
    typeof (contract as { verification_type?: unknown }).verification_type === "string"
      ? String((contract as { verification_type?: string }).verification_type)
      : "";
  const details =
    typeof (contract as { details?: unknown }).details === "object" &&
    (contract as { details?: unknown }).details != null
      ? ((contract as { details: Record<string, unknown> }).details ?? {})
      : {};
  const selfReportAutoApprove = details.self_report_auto_approve === true;
  const canSelfReportAutoApprove =
    verificationType === "self_report" && selfReportAutoApprove === true;

  if (evalResult.outcome === "approve") {
    const approvePatch: Record<string, unknown> = canSelfReportAutoApprove
      ? {
          status: "approved",
          validation_approved_at: nowIso,
          verified_at: nowIso,
          completed_at: nowIso,
          escalated_at: null,
        }
      : {
          // Canonical separation: evidence submission remains ACTION_SUBMITTED,
          // approval metadata marks ACTION_AWAITING_VERIFICATION.
          status: "submitted",
          validation_approved_at: nowIso,
          escalated_at: null,
        };
    console.log("[submit-validation] approve transition payload", {
      contractId,
      userId: user.id,
      verificationType,
      selfReportAutoApprove: canSelfReportAutoApprove,
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
      console.error("[submit-validation] approve transition failed", {
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

    // Backfill run_id for older rows (session_id is the arena run id); execution verification + run DONE happen in QR validate.
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

    await logEvaluation(null);
    const out = NextResponse.json({ outcome: "approve" });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (evalResult.outcome === "reject") {
    const { error: rjErr } = await supabase
      .from("bty_action_contracts")
      .update({ status: "rejected" })
      .eq("id", contractId)
      .eq("user_id", user.id);
    if (rjErr) {
      console.error("[submit-validation] reject failed", rjErr.message);
      const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    await logEvaluation(null);
    const out = NextResponse.json({ outcome: "reject" });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  // escalate (including Layer 2 technical failure → defer to human)
  const expiresAt = new Date(Date.now() + MS_72H).toISOString();
  const { error: esErr } = await supabase
    .from("bty_action_contracts")
    .update({
      status: "escalated",
      escalated_at: nowIso,
    })
    .eq("id", contractId)
    .eq("user_id", user.id);

  if (esErr) {
    console.error("[submit-validation] escalate status failed", esErr.message);
    const out = NextResponse.json({ error: "update_failed" }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (admin) {
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

  await logEvaluation(evalResult.layer2TechnicalError);

  const out = NextResponse.json({ outcome: "escalate" });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
