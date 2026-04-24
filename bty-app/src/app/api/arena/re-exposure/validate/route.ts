/**
 * POST `/api/arena/re-exposure/validate` — after re-exposure tradeoff (step 4), compute pattern-shift
 * (`changed` | `unstable` | `no_change`), persist on `arena_pending_outcomes`, then consume the pending row.
 * `unstable` / `no_change` may schedule another `arena_pending_outcomes` row (same `source_choice_history_id`, same axis)
 * with dedupe via `reinforcement_seeded_from_pending_id`. `changed` ends the reinforcement loop (no immediate reschedule).
 */
import { NextRequest, NextResponse } from "next/server";
import { markDueOutcomesDelivered } from "@/engine/scenario/delayed-outcome-trigger.service";
import { computeReexposureValidation } from "@/lib/bty/arena/reexposureValidation.server";
import type { ReexposureValidationPayload } from "@/lib/bty/arena/reexposureValidation.server";
import type { ArenaReinforcementLoopJson } from "@/lib/bty/arena/reinforcementLoopSchedule.server";
import {
  insertReinforcementDelayedOutcome,
  loopIterationForPendingRow,
} from "@/lib/bty/arena/reinforcementLoopSchedule.server";
import { upsertUserPatternSignatureFromValidation } from "@/lib/bty/arena/patternSignatureUpsert.server";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: { pendingOutcomeId?: unknown; runId?: unknown; scenarioId?: unknown };
  try {
    body = (await req.json()) as { pendingOutcomeId?: unknown; runId?: unknown; scenarioId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const pendingOutcomeId =
    typeof body.pendingOutcomeId === "string" ? body.pendingOutcomeId.trim() : "";
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const scenarioIdClaim = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
  if (!pendingOutcomeId || !runId || !scenarioIdClaim) {
    const out = NextResponse.json(
      { ok: false, error: "pending_outcome_run_scenario_required" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const out = NextResponse.json({ ok: false, error: "admin_unavailable" }, { status: 503 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: pendingRow, error: pErr } = await admin
    .from("arena_pending_outcomes")
    .select("id, status, source_choice_history_id, validation_payload, reinforcement_loop")
    .eq("id", pendingOutcomeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) {
    const out = NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const st = String((pendingRow as { status?: string } | null)?.status ?? "").toLowerCase();
  if (!pendingRow || st !== "pending") {
    const out = NextResponse.json({ ok: false, error: "pending_outcome_not_found_or_not_pending" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const hid = (pendingRow as { source_choice_history_id?: string | null }).source_choice_history_id;
  if (typeof hid !== "string" || hid.trim() === "") {
    const out = NextResponse.json({ ok: false, error: "pending_outcome_missing_history" }, { status: 422 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: histRow, error: hErr } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id")
    .eq("user_id", user.id)
    .eq("id", hid.trim())
    .maybeSingle();

  if (hErr) {
    const out = NextResponse.json({ ok: false, error: hErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const sidFromHistory =
    typeof (histRow as { scenario_id?: string } | null)?.scenario_id === "string"
      ? (histRow as { scenario_id: string }).scenario_id.trim()
      : "";
  if (!sidFromHistory || sidFromHistory !== scenarioIdClaim) {
    const out = NextResponse.json({ ok: false, error: "scenario_id_mismatch_history" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const { data: runRow, error: rErr } = await supabase
    .from("arena_runs")
    .select("run_id, scenario_id, user_id")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rErr) {
    const out = NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }
  const runScenarioId =
    typeof (runRow as { scenario_id?: string } | null)?.scenario_id === "string"
      ? (runRow as { scenario_id: string }).scenario_id.trim()
      : "";
  if (!runRow || !runScenarioId || runScenarioId !== sidFromHistory) {
    const out = NextResponse.json({ ok: false, error: "run_scenario_mismatch" }, { status: 403 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const computed = await computeReexposureValidation({
    supabase,
    userId: user.id,
    scenarioId: sidFromHistory,
    reexposureRunId: runId,
  });

  let payload: ReexposureValidationPayload;
  if (computed.ok) {
    payload = computed.payload;
  } else {
    const recorded_at = new Date().toISOString();
    payload = {
      scenario_id: sidFromHistory,
      before_axis: "",
      before_pattern_family: null,
      before_second_choice_direction: null,
      before_exit_pattern_key: "",
      action_decision_commitment: "unknown",
      after_axis: "",
      after_pattern_family: null,
      after_second_choice_direction: null,
      after_exit_pattern_key: "",
      validation_result: computed.fallback_result,
      axis_guard: "same_axis_ok",
      prior_run_id: null,
      reexposure_run_id: runId,
      recorded_at,
    };
  }

  const currentRowIteration = loopIterationForPendingRow(pendingRow as { reinforcement_loop?: unknown });
  const axis = (payload.after_axis || payload.before_axis || "").trim();
  const patternFamily = payload.after_pattern_family ?? payload.before_pattern_family ?? null;

  const vr = payload.validation_result;

  console.info("[arena][reexposure-validate]", {
    user_id: user.id,
    pending_outcome_id: pendingOutcomeId,
    pattern_family: patternFamily,
    axis: axis || null,
    validation_result: vr,
    reinforcement_loop_iteration: currentRowIteration,
  });

  let closingLoop: ArenaReinforcementLoopJson | null = null;
  if (vr === "changed") {
    closingLoop = {
      validation_result: "changed",
      source_pending_outcome_id: pendingOutcomeId,
      loop_iteration: currentRowIteration,
      loop_reason: "loop_satisfied_changed",
      next_scheduled_for: null,
      axis,
      pattern_family: patternFamily,
      loop_satisfied: true,
      follow_up_intensity: null,
    };
  } else if (vr === "unstable" || vr === "no_change") {
    closingLoop = {
      validation_result: vr,
      source_pending_outcome_id: pendingOutcomeId,
      loop_iteration: currentRowIteration,
      loop_reason: "validated_chained_follow_up",
      next_scheduled_for: null,
      axis,
      pattern_family: patternFamily,
      follow_up_intensity: vr === "no_change" ? "high" : "medium",
    };
  }

  const { error: upErr } = await admin
    .from("arena_pending_outcomes")
    .update({
      validation_payload: payload as unknown as Record<string, unknown>,
      ...(closingLoop ? { reinforcement_loop: closingLoop as unknown as Record<string, unknown> } : {}),
    })
    .eq("id", pendingOutcomeId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (upErr) {
    const out = NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let followUpScheduled = false;
  let newPendingOutcomeId: string | null = null;
  let nextScheduledFor: string | null = null;

  if (vr === "unstable" || vr === "no_change") {
    try {
      await markDueOutcomesDelivered(user.id, [pendingOutcomeId], admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "mark_delivered_failed";
      const out = NextResponse.json({ ok: false, error: msg, validation_payload: payload }, { status: 500 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const nextIter = currentRowIteration + 1;
    const ins = await insertReinforcementDelayedOutcome(admin, {
      userId: user.id,
      closingPendingOutcomeId: pendingOutcomeId,
      sourceChoiceHistoryId: hid.trim(),
      validationResult: vr,
      payload,
      nextLoopIteration: nextIter,
    });

    if (!ins.ok) {
      const out = NextResponse.json(
        {
          ok: false,
          error: ins.error ?? "reinforcement_schedule_failed",
          validation_payload: payload,
        },
        { status: 500 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    followUpScheduled = true;
    newPendingOutcomeId = ins.newPendingId;
    nextScheduledFor = ins.next_scheduled_for;

    if (nextScheduledFor && closingLoop) {
      const merged: ArenaReinforcementLoopJson = {
        ...closingLoop,
        next_scheduled_for: nextScheduledFor,
      };
      await admin
        .from("arena_pending_outcomes")
        .update({ reinforcement_loop: merged as unknown as Record<string, unknown> })
        .eq("id", pendingOutcomeId)
        .eq("user_id", user.id);
      closingLoop = merged;
    }
  } else {
    try {
      await markDueOutcomesDelivered(user.id, [pendingOutcomeId], admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "mark_delivered_failed";
      const out = NextResponse.json({ ok: false, error: msg, validation_payload: payload }, { status: 500 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  const signatureWatchpoint =
    payload.validation_result === "unstable" || payload.validation_result === "no_change"
      ? nextScheduledFor
      : null;
  const sigUp = await upsertUserPatternSignatureFromValidation({
    admin,
    userId: user.id,
    payload,
    pendingOutcomeId,
    sourceChoiceHistoryId: hid.trim(),
    nextWatchpointIso: signatureWatchpoint,
  });
  if (!sigUp.ok) {
    console.warn("[pattern_signature] upsert_failed", { message: sigUp.error });
  }

  const out = NextResponse.json({
    ok: true,
    validation_result: payload.validation_result,
    validation_payload: payload,
    reinforcement_loop: closingLoop,
    follow_up_scheduled: followUpScheduled,
    new_pending_outcome_id: newPendingOutcomeId,
    next_scheduled_for: nextScheduledFor,
  });
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
