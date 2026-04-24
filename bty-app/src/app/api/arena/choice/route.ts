import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { evaluateChoice } from "@/lib/bty/arena/engine";
import {
  buildArenaBindingSnapshotResponse,
  type BindingSnapshotPhase,
} from "@/lib/bty/arena/binding/buildArenaBindingSnapshotResponse.server";
import { eliteChainScenarioBindingIncompleteReason } from "@/lib/bty/arena/binding/eliteChainBindingCompleteness.server";
import { eliteScenarioToScenario, getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";
import { ensureEliteBindingActionCommitmentContract } from "@/lib/bty/arena/eliteBindingActionCommitment.server";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";
import { recordVerticalSliceActionDecisionHistory } from "@/lib/bty/arena/verticalSliceChoiceHistoryBridge.server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

/**
 * After inserting an arena event with step ≥ 2, mirror POST `/api/arena/event`:
 * update `arena_runs.current_step` / `reached_step_2_at`, then apply `increment_arena_xp` when xp &gt; 0.
 */
async function syncRunProgressAndXp(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  insertStep: number,
  xp: number,
): Promise<{ error: string } | null> {
  if (insertStep >= 2) {
    const nowIso = new Date().toISOString();
    const { data: runRow } = await supabase
      .from("arena_runs")
      .select("reached_step_2_at")
      .eq("run_id", runId)
      .eq("user_id", userId)
      .maybeSingle();
    const reached = (runRow as { reached_step_2_at?: string | null } | null)?.reached_step_2_at;
    const { error: upRunErr } = await supabase
      .from("arena_runs")
      .update({
        current_step: insertStep,
        ...(reached == null || String(reached).trim() === ""
          ? { reached_step_2_at: nowIso }
          : {}),
      })
      .eq("run_id", runId)
      .eq("user_id", userId);
    if (upRunErr) return { error: upRunErr.message };
  }

  if (xp > 0) {
    const { error: rpcErr } = await supabase.rpc("increment_arena_xp", {
      p_user_id: userId,
      p_run_id: runId,
      p_xp: xp,
    });
    if (rpcErr) return { error: rpcErr.message };
  }
  return null;
}

/**
 * POST /api/arena/choice — binding-layer primary choice: JSON ids + DB ids → canonical runtime snapshot.
 * Records `arena_events` then returns snapshot authority (same shape as GET session router + binding fields).
 *
 * **XP parity with `POST /api/arena/event` (`CHOICE_CONFIRMED`):**
 * - **Primary:** server-side {@link evaluateChoice} (same inputs as client engine) → `arena_events.xp` + `deltas` +
 *   `increment_arena_xp` + `arena_runs` step sync — matches legacy `postArenaEvent` when `eventType` is `CHOICE_CONFIRMED`.
 * - **Tradeoff (`binding_phase: tradeoff` or legacy `second`):** no choice XP; `xp` **0** — same as `POST /api/arena/run/step` step 4.
 * - **Action decision (`binding_phase: action_decision`):** third meaningful choice; `xp` **0**; contract snapshot only after this phase.
 */
export async function POST(req: NextRequest) {
  const { user, base, supabase } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    const out = NextResponse.json({ error: "invalid_json" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const run_id = typeof body.run_id === "string" ? body.run_id.trim() : "";
  const json_scenario_id = typeof body.json_scenario_id === "string" ? body.json_scenario_id.trim() : "";
  const db_scenario_id = typeof body.db_scenario_id === "string" ? body.db_scenario_id.trim() : "";
  const json_choice_id = typeof body.json_choice_id === "string" ? body.json_choice_id.trim() : "";
  const db_choice_id = typeof body.db_choice_id === "string" ? body.db_choice_id.trim() : "";

  if (!run_id || !json_scenario_id || !db_scenario_id || !json_choice_id || !db_choice_id) {
    const out = NextResponse.json(
      { error: "missing_fields", message: "run_id, json_scenario_id, db_scenario_id, json_choice_id, db_choice_id required" },
      { status: 400 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const binding_phase_raw = typeof body.binding_phase === "string" ? body.binding_phase.trim().toLowerCase() : "";
  let binding_phase: BindingSnapshotPhase = "primary";
  if (binding_phase_raw === "second" || binding_phase_raw === "tradeoff") {
    binding_phase = "tradeoff";
  } else if (binding_phase_raw === "action_decision") {
    binding_phase = "action_decision";
  }

  const { data: runRow, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id, user_id, scenario_id, status, meta, started_at")
    .eq("run_id", run_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (runErr || !runRow) {
    const out = NextResponse.json({ error: "run_not_found_or_forbidden" }, { status: 404 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const runStartedAtIso =
    typeof (runRow as { started_at?: string }).started_at === "string" &&
    (runRow as { started_at: string }).started_at.trim() !== ""
      ? (runRow as { started_at: string }).started_at
      : new Date(0).toISOString();

  const runScenarioId = typeof (runRow as { scenario_id?: string }).scenario_id === "string"
    ? (runRow as { scenario_id: string }).scenario_id.trim()
    : "";
  if (runScenarioId !== db_scenario_id) {
    const out = NextResponse.json({ error: "db_scenario_mismatch" }, { status: 409 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (!isEliteChainScenarioId(db_scenario_id)) {
    const out = NextResponse.json({ error: "binding_only_elite_chain_scenarios" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let scenarioTitle: string | null = null;
  let elite: ReturnType<typeof getEliteScenarioById>;
  try {
    elite = getEliteScenarioById(db_scenario_id);
    scenarioTitle = typeof elite.title === "string" ? elite.title : null;
  } catch {
    const out = NextResponse.json({ error: "scenario_catalog_unavailable" }, { status: 400 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const scenarioLib = eliteScenarioToScenario(elite, "en");

  const bindingGap = eliteChainScenarioBindingIncompleteReason(scenarioLib);
  if (bindingGap) {
    const out = NextResponse.json(
      { error: "elite_binding_incomplete", code: bindingGap },
      { status: 422 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  let actionDecisionOutcome: "commitment_contract" | "avoidance_wrap_up" | undefined;
  /** Tradeoff tier pattern family for action-commitment contract (canonical second-choice id from run meta). */
  let secondTierPatternFamilyForCommit: string | undefined;
  let commitmentContractIdForSnapshot: string | undefined;

  let insertStep = 2;
  let insertEventType = "CHOICE_CONFIRMED";
  let xp = 0;
  let deltas: Record<string, unknown> | null = null;

  const prevMetaBase =
    runRow.meta != null && typeof runRow.meta === "object" && !Array.isArray(runRow.meta)
      ? (runRow.meta as Record<string, unknown>)
      : {};

  if (binding_phase === "primary") {
    const primaryChoice = scenarioLib.choices.find((ch) => ch.choiceId === json_choice_id);
    if (!primaryChoice || primaryChoice.dbChoiceId !== db_choice_id) {
      const out = NextResponse.json({ error: "primary_choice_binding_mismatch" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const evalResult = evaluateChoice({
      scenarioId: json_scenario_id,
      choiceId: primaryChoice.choiceId,
      intent: primaryChoice.intent,
      xpBase: primaryChoice.xpBase,
      difficulty: primaryChoice.difficulty,
      hiddenDelta: primaryChoice.hiddenDelta ?? {},
    });
    xp = evalResult.xp;
    deltas = evalResult.deltas as Record<string, unknown>;
  }

  let tradeoffLeadsToActionDecision = false;

  if (binding_phase === "tradeoff") {
    const branchKeyRaw = prevMetaBase["escalation_branch_key"] ?? prevMetaBase["primary_choice_id"];
    const branchKey = typeof branchKeyRaw === "string" ? branchKeyRaw.trim() : "";
    const branches = scenarioLib.escalationBranches;
    const branch = branchKey && branches ? branches[branchKey] : undefined;
    const picked = branch?.second_choices.find((c) => c.id === json_choice_id);
    if (!picked || picked.dbChoiceId !== db_choice_id) {
      const out = NextResponse.json({ error: "second_choice_binding_mismatch" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    tradeoffLeadsToActionDecision = Boolean(
      branch?.action_decision?.choices && branch.action_decision.choices.length > 0,
    );
    if (!tradeoffLeadsToActionDecision) {
      const out = NextResponse.json(
        { error: "elite_tradeoff_missing_action_decision", code: "action_decision_layer_required" },
        { status: 422 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    insertStep = 4;
    /** Distinct from `SECOND_CHOICE_CONFIRMED` in `POST /api/arena/run/step` — see comment there. */
    insertEventType = "BINDING_V1_SECOND";
    xp = 0;
    deltas = null;
  }

  if (binding_phase === "action_decision") {
    const branchKeyRaw = prevMetaBase["escalation_branch_key"] ?? prevMetaBase["primary_choice_id"];
    const branchKey = typeof branchKeyRaw === "string" ? branchKeyRaw.trim() : "";
    const branches = scenarioLib.escalationBranches;
    const branch = branchKey && branches ? branches[branchKey] : undefined;
    const ad = branch?.action_decision;
    const picked = ad?.choices.find((c) => c.id === json_choice_id);
    if (!picked || picked.dbChoiceId !== db_choice_id) {
      const out = NextResponse.json({ error: "action_decision_binding_mismatch" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const secondId = prevMetaBase["second_choice_id"];
    if (typeof secondId !== "string" || secondId.trim() === "") {
      const out = NextResponse.json({ error: "action_decision_requires_tradeoff_meta" }, { status: 409 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const isCommit = picked.meaning?.is_action_commitment === true;
    actionDecisionOutcome = isCommit ? "commitment_contract" : "avoidance_wrap_up";
    const secondTier = branch?.second_choices.find((s) => s.id === secondId.trim());
    secondTierPatternFamilyForCommit =
      typeof secondTier?.pattern_family === "string" ? secondTier.pattern_family.trim() : undefined;
    insertStep = 5;
    insertEventType = "BINDING_V1_ACTION_DECISION";
    xp = 0;
    deltas = null;
  }

  if (binding_phase === "action_decision" && actionDecisionOutcome === "commitment_contract") {
    const admin = getSupabaseAdmin();
    if (!admin) {
      const out = NextResponse.json({ error: "elite_action_contract_admin_unavailable" }, { status: 503 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const ensured = await ensureEliteBindingActionCommitmentContract(admin, {
      userId: user.id,
      runId: run_id,
      dbScenarioId: db_scenario_id,
      patternFamilyRaw: secondTierPatternFamilyForCommit,
    });
    if (!ensured.ok || ensured.contractId == null) {
      const out = NextResponse.json(
        { error: "elite_action_contract_ensure_failed", contractId: ensured.contractId },
        { status: 503 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    commitmentContractIdForSnapshot = ensured.contractId;
  }

  const { error: insErr } = await supabase.from("arena_events").insert({
    run_id,
    user_id: user.id,
    step: insertStep,
    event_type: insertEventType,
    scenario_id: db_scenario_id,
    choice_id: json_choice_id,
    xp,
    deltas,
    meta: {
      binding: "v1",
      binding_phase,
      json_scenario_id,
      db_scenario_id,
      json_choice_id,
      db_choice_id,
      ...(binding_phase === "action_decision" && actionDecisionOutcome
        ? { action_decision_outcome: actionDecisionOutcome }
        : {}),
    },
  });

  if (insErr) {
    const out = NextResponse.json({ error: "event_insert_failed", message: insErr.message }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const syncErr = await syncRunProgressAndXp(supabase, user.id, run_id, insertStep, xp);
  if (syncErr) {
    const out = NextResponse.json({ error: "xp_or_run_sync_failed", message: syncErr.error }, { status: 500 });
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  if (binding_phase === "action_decision") {
    const nowIso = new Date().toISOString();
    const nextMeta: Record<string, unknown> = {
      ...prevMetaBase,
      action_decision_choice_id: json_choice_id,
      action_decision_recorded_at: nowIso,
    };

    if (actionDecisionOutcome === "commitment_contract") {
      nextMeta.action_decision_commitment = true;
    } else if (actionDecisionOutcome === "avoidance_wrap_up") {
      nextMeta.action_decision_avoidance = true;
      nextMeta.no_change_risk_signal_at = nowIso;
      nextMeta.intervention_sensitivity_escalation = true;
    }

    const { error: metaUpErr } = await supabase
      .from("arena_runs")
      .update({ meta: nextMeta })
      .eq("run_id", run_id)
      .eq("user_id", user.id);
    if (metaUpErr) {
      const out = NextResponse.json(
        { error: "run_meta_update_failed", message: metaUpErr.message },
        { status: 500 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }

    const hist = await recordVerticalSliceActionDecisionHistory({
      userId: user.id,
      dbScenarioId: db_scenario_id,
      jsonChoiceId: json_choice_id,
      runStartedAtIso,
      secondTierPatternFamily: secondTierPatternFamilyForCommit,
    });
    if (!hist.ok) {
      console.error("[arena/choice] vertical_slice choice history bridge failed", {
        run_id,
        db_scenario_id,
        skipped: hist.skipped,
      });
    }
  }

  const snapshot = await buildArenaBindingSnapshotResponse(supabase, user.id, {
    runId: run_id,
    jsonScenarioId: json_scenario_id,
    dbScenarioId: db_scenario_id,
    jsonChoiceId: json_choice_id,
    dbChoiceId: db_choice_id,
    scenarioTitle,
    bindingPhase: binding_phase,
    ...(binding_phase === "tradeoff" ? { tradeoffLeadsToActionDecision } : {}),
    ...(binding_phase === "action_decision" && actionDecisionOutcome
      ? {
          actionDecisionOutcome,
          ...(actionDecisionOutcome === "commitment_contract" && commitmentContractIdForSnapshot
            ? { commitmentContractId: commitmentContractIdForSnapshot }
            : {}),
        }
      : {}),
  });

  const out = NextResponse.json(snapshot);
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
