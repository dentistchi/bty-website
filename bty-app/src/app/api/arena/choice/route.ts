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
import { accrueNoChangeRisk } from "@/lib/bty/arena/noChangeRisk.server";
import { getScenarioByDbId, getScenarioById } from "@/data/scenario";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { copyCookiesAndDebug, requireUser, unauthenticated } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

function enforceActionRequiredContractInvariant<T extends Record<string, unknown>>(snapshot: T): T {
  const runtimeState = snapshot.runtime_state;
  if (runtimeState !== "ACTION_REQUIRED") return snapshot;
  const actionContract =
    snapshot.action_contract != null && typeof snapshot.action_contract === "object"
      ? (snapshot.action_contract as { exists?: unknown; id?: unknown })
      : null;
  const hasContract = actionContract?.exists === true && typeof actionContract.id === "string" && actionContract.id.trim() !== "";
  if (hasContract) return snapshot;
  return {
    ...snapshot,
    runtime_state: "ERROR",
    state_priority: 100,
    error: "action_required_contract_invariant_failed",
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

type ReExposurePendingSeed = {
  incidentId: string | null;
  axisGroup: string | null;
  axisIndex: number | null;
  patternFamily: string | null;
};

function looksLikeCoreFolderScenarioId(value: string): boolean {
  return /^core_\d{2}_/i.test(value);
}

type BindingScenarioLib = {
  title?: string;
  choices: Array<{
    choiceId: string;
    dbChoiceId?: string;
    intent?: string;
    xpBase?: number;
    difficulty?: number;
    hiddenDelta?: Record<string, unknown>;
  }>;
  escalationBranches?: Record<string, {
    second_choices?: Array<{ id: string; dbChoiceId?: string; pattern_family?: string; direction?: "entry" | "exit" }>;
    action_decision?: {
      choices: Array<{ id: string; dbChoiceId?: string; meaning?: { is_action_commitment?: boolean } }>;
    };
  }>;
};

function applyCanonicalBaseBindingToEscalation(params: {
  base: {
    structure: {
      tradeoff: Record<string, Array<{ choiceId: string; dbChoiceId: string }>>;
      action_decision: Record<string, Array<{ choiceId: string; dbChoiceId: string; is_action_commitment?: boolean }>>;
    };
  };
  escalationBranches: BindingScenarioLib["escalationBranches"];
}): BindingScenarioLib["escalationBranches"] {
  const src = params.escalationBranches;
  if (!src) return src;
  const out: NonNullable<BindingScenarioLib["escalationBranches"]> = {};
  for (const [primaryId, branch] of Object.entries(src)) {
    const secondChoices = (branch?.second_choices ?? []).map((second) => {
      const mapping = (params.base.structure.tradeoff[primaryId] ?? []).find((m) => m.choiceId === second.id);
      return {
        ...second,
        dbChoiceId:
          typeof mapping?.dbChoiceId === "string" && mapping.dbChoiceId.trim() !== ""
            ? mapping.dbChoiceId.trim()
            : second.dbChoiceId,
      };
    });
    const actionChoices = (branch?.action_decision?.choices ?? []).map((choice) => {
      const mappings =
        params.base.structure.action_decision[`${primaryId}_X`] ??
        params.base.structure.action_decision[`${primaryId}_Y`] ??
        [];
      const mapping = mappings.find((m) => m.choiceId === choice.id);
      return {
        ...choice,
        dbChoiceId:
          typeof mapping?.dbChoiceId === "string" && mapping.dbChoiceId.trim() !== ""
            ? mapping.dbChoiceId.trim()
            : choice.dbChoiceId,
      };
    });
    out[primaryId] = {
      ...branch,
      second_choices: secondChoices,
      action_decision: branch?.action_decision
        ? {
            ...branch.action_decision,
            choices: actionChoices,
          }
        : undefined,
    };
  }
  return out;
}

async function ensureNoChangeReexposurePendingOutcome(params: {
  serviceSupabase: SupabaseClient;
  userId: string;
  dbScenarioId: string;
  jsonScenarioId: string;
  jsonChoiceId: string;
  seed: ReExposurePendingSeed;
}): Promise<{ pendingOutcomeId: string | null; error: string | null }> {
  console.info("[BTY REEXPOSURE] ensureNoChangeReexposurePendingOutcome:start", {
    user_id: params.userId,
    db_scenario_id: params.dbScenarioId,
    json_scenario_id: params.jsonScenarioId,
    json_choice_id: params.jsonChoiceId,
  });
  const historyScenarioCandidates = [params.dbScenarioId, params.jsonScenarioId].filter(
    (v, i, arr): v is string => typeof v === "string" && v.trim() !== "" && arr.indexOf(v) === i,
  );
  const { data: latestHistory, error: historyErr } = await params.serviceSupabase
    .from("user_scenario_choice_history")
    .select("id")
    .eq("user_id", params.userId)
    .in("scenario_id", historyScenarioCandidates)
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historyErr) {
    return { pendingOutcomeId: null, error: `history_lookup_failed:${historyErr.message}` };
  }
  let sourceChoiceHistoryId =
    typeof (latestHistory as { id?: string } | null)?.id === "string"
      ? (latestHistory as { id: string }).id.trim()
      : "";
  if (!sourceChoiceHistoryId) {
    const fallbackScenarioId = params.jsonScenarioId.trim() !== "" ? params.jsonScenarioId : params.dbScenarioId;
    const { data: seededHistory, error: seedErr } = await params.serviceSupabase
      .from("user_scenario_choice_history")
      .insert({
        user_id: params.userId,
        scenario_id: fallbackScenarioId,
        choice_id: params.jsonChoiceId,
        flag_type: "INTEGRITY_SLIP",
        played_at: new Date().toISOString(),
        scenario_type: "elite_reexposure_seed",
        outcome_triggered: false,
      })
      .select("id")
      .maybeSingle();
    if (seedErr) {
      return { pendingOutcomeId: null, error: `history_seed_failed:${seedErr.message}` };
    }
    sourceChoiceHistoryId =
      typeof (seededHistory as { id?: string } | null)?.id === "string"
        ? (seededHistory as { id: string }).id.trim()
        : "";
    if (!sourceChoiceHistoryId) {
      return { pendingOutcomeId: null, error: "history_seed_id_missing" };
    }
  }

  const { data: existingPending, error: existingErr } = await params.serviceSupabase
    .from("arena_pending_outcomes")
    .select("id")
    .eq("user_id", params.userId)
    .eq("source_choice_history_id", sourceChoiceHistoryId)
    .eq("status", "pending")
    .maybeSingle();
  if (existingErr) {
    return { pendingOutcomeId: null, error: `pending_lookup_failed:${existingErr.message}` };
  }
  if (typeof existingPending?.id === "string" && existingPending.id.trim() !== "") {
    return { pendingOutcomeId: existingPending.id.trim(), error: null };
  }

  const nowIso = new Date().toISOString();
  const validationPayload = {
    incident_id: params.seed.incidentId,
    scenario_id: params.jsonScenarioId,
    db_scenario_id: params.dbScenarioId,
    axis_group: params.seed.axisGroup,
    axis_index: params.seed.axisIndex,
    pattern_family: params.seed.patternFamily,
    source: "no_change_risk",
  };
  const { data: inserted, error: insertErr } = await params.serviceSupabase
    .from("arena_pending_outcomes")
    .insert({
      user_id: params.userId,
      source_choice_history_id: sourceChoiceHistoryId,
      choice_type: "no_change_reexposure",
      outcome_title: "Re-exposure round",
      outcome_body: JSON.stringify(validationPayload),
      status: "pending",
      scheduled_for: nowIso,
      validation_payload: validationPayload as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();
  if (insertErr) {
    const code = (insertErr as { code?: string }).code;
    if (code === "23505") {
      const { data: afterConflict } = await params.serviceSupabase
        .from("arena_pending_outcomes")
        .select("id")
        .eq("user_id", params.userId)
        .eq("source_choice_history_id", sourceChoiceHistoryId)
        .eq("status", "pending")
        .maybeSingle();
      return {
        pendingOutcomeId: typeof afterConflict?.id === "string" ? afterConflict.id : null,
        error: null,
      };
    }
    return { pendingOutcomeId: null, error: `pending_insert_failed:${insertErr.message}` };
  }
  return {
    pendingOutcomeId: typeof inserted?.id === "string" ? inserted.id : null,
    error: null,
  };
}

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

  const looksLikeCanonicalJsonScenarioId = looksLikeCoreFolderScenarioId(json_scenario_id);
  const looksLikeFolderScenarioIdUsedAsDb = looksLikeCoreFolderScenarioId(db_scenario_id);
  if (looksLikeCanonicalJsonScenarioId && looksLikeFolderScenarioIdUsedAsDb) {
    const out = NextResponse.json(
      { error: "db_scenario_id_must_be_canonical_base_db_scenario_id" },
      { status: 422 },
    );
    copyCookiesAndDebug(base, out, req, true);
    return out;
  }

  const binding_phase_raw = typeof body.binding_phase === "string" ? body.binding_phase.trim().toLowerCase() : "";
  const body_primary_choice_id = typeof body.primary_choice_id === "string" ? body.primary_choice_id.trim() : "";
  const body_parent_choice_id = typeof body.parent_choice_id === "string" ? body.parent_choice_id.trim() : "";
  const body_second_choice_id = typeof body.second_choice_id === "string" ? body.second_choice_id.trim() : "";
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

  let runScenarioId = typeof (runRow as { scenario_id?: string }).scenario_id === "string"
    ? (runRow as { scenario_id: string }).scenario_id.trim()
    : "";
  const expectedDbScenarioIdFromJson = (() => {
    if (isEliteChainScenarioId(json_scenario_id)) {
      try {
        return eliteScenarioToScenario(getEliteScenarioById(json_scenario_id), "en").dbScenarioId ?? null;
      } catch {
        return null;
      }
    }
    return getScenarioById(json_scenario_id, "en")?.dbScenarioId ?? null;
  })();
  if (runScenarioId !== db_scenario_id) {
    const migrateLegacyCoreRunToCanonicalDbId =
      looksLikeCoreFolderScenarioId(runScenarioId) &&
      expectedDbScenarioIdFromJson != null &&
      db_scenario_id === expectedDbScenarioIdFromJson;
    if (migrateLegacyCoreRunToCanonicalDbId) {
      // Resolve in memory only — do NOT update arena_runs.scenario_id.
      // The DB record stays as the folder name so the served-exclusion in
      // scenario-selector.service.ts continues to match the catalog's folder-name keys.
      runScenarioId = db_scenario_id;
    } else {
      const out = NextResponse.json(
        {
          error: "db_scenario_mismatch",
          currentRunScenarioId: runScenarioId,
          requestedDbScenarioId: db_scenario_id,
          expectedDbScenarioId: expectedDbScenarioIdFromJson,
          jsonScenarioId: json_scenario_id,
        },
        { status: 409 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  let scenarioLib: BindingScenarioLib;
  let scenarioTitle: string | null = null;
  const eliteJsonScenario = isEliteChainScenarioId(json_scenario_id);
  if (eliteJsonScenario) {
    let elite: ReturnType<typeof getEliteScenarioById>;
    try {
      elite = getEliteScenarioById(json_scenario_id);
      scenarioTitle = typeof elite.title === "string" ? elite.title : null;
    } catch {
      const out = NextResponse.json({ error: "scenario_catalog_unavailable" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const eliteScenario = eliteScenarioToScenario(elite, "en");
    const bindingGap = eliteChainScenarioBindingIncompleteReason(eliteScenario);
    if (bindingGap) {
      const out = NextResponse.json(
        { error: "elite_binding_incomplete", code: bindingGap },
        { status: 422 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    scenarioLib = {
      title: eliteScenario.title,
      choices: eliteScenario.choices,
      escalationBranches: eliteScenario.escalationBranches,
    };
  } else {
    const canonicalScenario = getScenarioByDbId(db_scenario_id, "en");
    if (!canonicalScenario) {
      const out = NextResponse.json({ error: "binding_only_elite_chain_scenarios" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    scenarioTitle = canonicalScenario.content.title;
    scenarioLib = {
      title: canonicalScenario.content.title,
      choices: canonicalScenario.content.choices.map((ch) => ({
        ...ch,
        choiceId: ch.id,
      })),
      escalationBranches: applyCanonicalBaseBindingToEscalation({
        base: canonicalScenario.base,
        escalationBranches: canonicalScenario.content.escalationBranches as BindingScenarioLib["escalationBranches"],
      }),
    };
  }

  let actionDecisionOutcome: "commitment_contract" | "avoidance_wrap_up" | undefined;
  let reExposureDueCandidate = false;
  let reExposurePendingOutcomeId: string | null = null;
  let reExposureSeed: ReExposurePendingSeed = {
    incidentId: null,
    axisGroup: null,
    axisIndex: null,
    patternFamily: null,
  };
  /** Tradeoff tier pattern family for action-commitment contract (canonical second-choice id from run meta). */
  let secondTierPatternFamilyForCommit: string | undefined;
  let actionDecisionLabelForCommit: string | undefined;
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
      intent: typeof primaryChoice.intent === "string" ? primaryChoice.intent : "unknown",
      xpBase: typeof primaryChoice.xpBase === "number" ? primaryChoice.xpBase : 0,
      difficulty: typeof primaryChoice.difficulty === "number" ? primaryChoice.difficulty : 1,
      hiddenDelta: primaryChoice.hiddenDelta ?? {},
    });
    xp = evalResult.xp;
    deltas = evalResult.deltas as Record<string, unknown>;
  }

  let tradeoffLeadsToActionDecision = false;
  let tradeoffDirection: string | undefined;
  let tradeoffPatternFamily: string | undefined;

  if (binding_phase === "tradeoff") {
    const branchKeyRaw =
      body_primary_choice_id ||
      body_parent_choice_id ||
      prevMetaBase["escalation_branch_key"] ||
      prevMetaBase["primary_choice_id"];
    const branchKey = typeof branchKeyRaw === "string" ? branchKeyRaw.trim() : "";
    if (!branchKey) {
      const out = NextResponse.json({ error: "missing_primary_choice_id_for_tradeoff" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const branches = scenarioLib.escalationBranches;
    const branch = branchKey && branches ? branches[branchKey] : undefined;
    const picked = branch?.second_choices?.find((c) => c.id === json_choice_id);
    if (!picked || picked.dbChoiceId !== db_choice_id) {
      const out = NextResponse.json(
        {
          error: "second_choice_binding_mismatch",
          expectedDbChoiceId: picked?.dbChoiceId ?? null,
          receivedDbChoiceId: db_choice_id,
          primaryChoiceId: branchKey || null,
          secondChoiceId: json_choice_id,
        },
        { status: 400 },
      );
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
    tradeoffDirection = picked.direction;
    tradeoffPatternFamily = picked.pattern_family;
    if (!tradeoffDirection) {
      console.warn("[choice][tradeoff] direction undefined", { json_choice_id, branchKey });
    }
    insertStep = 4;
    /** Distinct from `SECOND_CHOICE_CONFIRMED` in `POST /api/arena/run/step` — see comment there. */
    insertEventType = "BINDING_V1_SECOND";
    xp = 0;
    deltas = null;
    const nextMeta = {
      ...prevMetaBase,
      escalation_branch_key: branchKey,
      primary_choice_id: branchKey,
      second_choice_id: json_choice_id,
      second_choice_recorded_at: new Date().toISOString(),
    };
    const { error: tradeoffMetaUpErr } = await supabase
      .from("arena_runs")
      .update({ meta: nextMeta })
      .eq("run_id", run_id)
      .eq("user_id", user.id);
    if (tradeoffMetaUpErr) {
      const out = NextResponse.json(
        { error: "run_meta_update_failed", message: tradeoffMetaUpErr.message },
        { status: 500 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
  }

  if (binding_phase === "action_decision") {
    const branchKeyRaw =
      body_primary_choice_id ||
      body_parent_choice_id ||
      prevMetaBase["escalation_branch_key"] ||
      prevMetaBase["primary_choice_id"];
    const branchKey = typeof branchKeyRaw === "string" ? branchKeyRaw.trim() : "";
    if (!branchKey) {
      const out = NextResponse.json({ error: "missing_primary_choice_id_for_action_decision" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const secondId = body_second_choice_id || prevMetaBase["second_choice_id"];
    if (typeof secondId !== "string" || secondId.trim() === "") {
      const out = NextResponse.json({ error: "missing_second_choice_id_for_action_decision" }, { status: 400 });
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const secondChoiceId = secondId.trim();
    const branches = scenarioLib.escalationBranches;
    const branch = branchKey && branches ? branches[branchKey] : undefined;
    const ad = branch?.action_decision;
    const mappedScenario = getScenarioByDbId(db_scenario_id, "en");
    const canonicalActionMappings = mappedScenario?.base?.structure?.action_decision?.[`${branchKey}_${secondChoiceId}`];
    const expectedActionDbChoiceId =
      (canonicalActionMappings ?? []).find((m) => m.choiceId === json_choice_id)?.dbChoiceId ??
      ad?.choices.find((c) => c.id === json_choice_id)?.dbChoiceId ??
      null;
    if (!expectedActionDbChoiceId) {
      const out = NextResponse.json(
        {
          error: "action_decision_binding_missing",
          primaryChoiceId: branchKey,
          secondChoiceId,
          actionChoiceId: json_choice_id,
        },
        { status: 400 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    if (expectedActionDbChoiceId !== db_choice_id) {
      const out = NextResponse.json(
        {
          error: "action_decision_binding_mismatch",
          expectedDbChoiceId: expectedActionDbChoiceId,
          receivedDbChoiceId: db_choice_id,
          primaryChoiceId: branchKey,
          secondChoiceId,
          actionChoiceId: json_choice_id,
        },
        { status: 400 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    const picked = ad?.choices.find((c) => c.id === json_choice_id);
    const pickedLabel = (() => {
      if (picked == null || typeof picked !== "object" || !("label" in picked)) return null;
      const label = (picked as { label?: unknown }).label;
      return typeof label === "string" && label.trim() !== "" ? label.trim() : null;
    })();
    actionDecisionLabelForCommit =
      pickedLabel != null
        ? pickedLabel
        : undefined;
    const mappingCommitment = (canonicalActionMappings ?? []).find((m) => m.choiceId === json_choice_id)?.is_action_commitment;
    const isCommit =
      (typeof mappingCommitment === "boolean" ? mappingCommitment : undefined) ??
      (picked?.meaning?.is_action_commitment === true);
    actionDecisionOutcome = isCommit ? "commitment_contract" : "avoidance_wrap_up";
    const primaryChoice = scenarioLib.choices.find((c) => c.choiceId === branchKey);
    const primaryPatternFamily =
      typeof primaryChoice?.intent === "string" ? primaryChoice.intent.trim() : "unknown";
    const secondTier = branch?.second_choices?.find((s) => s.id === secondChoiceId);
    secondTierPatternFamilyForCommit =
      typeof secondTier?.pattern_family === "string" ? secondTier.pattern_family.trim() : undefined;
    const secondPatternFamily =
      typeof secondTier?.pattern_family === "string" ? secondTier.pattern_family.trim() : undefined;
    const isCanonicalScenarioDbId = db_scenario_id.startsWith("INCIDENT-");
    if (!mappedScenario && isCanonicalScenarioDbId) {
      const out = NextResponse.json(
        { error: "action_decision_scenario_binding_unresolved" },
        { status: 422 },
      );
      copyCookiesAndDebug(base, out, req, true);
      return out;
    }
    if (!mappedScenario && !isCanonicalScenarioDbId) {
      console.warn("[arena/choice] skip no-change risk accrual for non-canonical scenario id", {
        db_scenario_id,
        json_scenario_id,
      });
    }
    const incidentId = mappedScenario?.incidentId ?? null;
    const axisGroup = mappedScenario?.axisGroup ?? null;
    const axisIndex = typeof mappedScenario?.axisIndex === "number" ? mappedScenario.axisIndex : null;
    reExposureSeed = {
      incidentId,
      axisGroup,
      axisIndex,
      patternFamily: secondPatternFamily ?? primaryPatternFamily,
    };
    insertStep = 5;
    insertEventType = "BINDING_V1_ACTION_DECISION";
    xp = 0;
    deltas = null;

    if (!isCommit && mappedScenario) {
      try {
        const risk = await accrueNoChangeRisk(supabase, {
          userId: user.id,
          incidentId: incidentId ?? "unknown_incident",
          scenarioId: json_scenario_id,
          dbScenarioId: db_scenario_id,
          axisGroup: axisGroup ?? "Ownership",
          axisIndex: axisIndex ?? 0,
          primaryPatternFamily,
          secondPatternFamily: secondPatternFamily ?? primaryPatternFamily,
          actionChoiceId: json_choice_id,
          actionDbChoiceId: expectedActionDbChoiceId,
          isActionCommitment: false,
          timestamp: new Date().toISOString(),
        });
        reExposureDueCandidate = risk.reExposureDueCandidate;
      } catch (riskErr) {
        const message = riskErr instanceof Error ? riskErr.message : String(riskErr);
        const out = NextResponse.json(
          { error: "action_decision_no_change_risk_invalid", message },
          { status: 400 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
    }
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
      actionLabelRaw: actionDecisionLabelForCommit,
    });
    if (!ensured.ok || ensured.contractId == null) {
      console.error("[arena/choice] elite_action_contract_ensure_failed", {
        run_id,
        db_scenario_id,
        detail: ensured.detail ?? null,
      });
      const out = NextResponse.json(
        {
          error: "elite_action_contract_ensure_failed",
          contractId: ensured.contractId,
          detail: ensured.detail ?? null,
          mode: ARENA_SESSION_MODE,
          runtime_state: "ERROR",
          state_priority: 100,
          gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
          action_contract: {
            exists: false,
            id: null,
            status: null,
            verification_type: null,
            deadline_at: null,
          },
        },
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
      ...(binding_phase === "tradeoff" && tradeoffDirection
        ? { direction: tradeoffDirection, pattern_family: tradeoffPatternFamily }
        : {}),
      ...(binding_phase === "action_decision" && actionDecisionOutcome
        ? { action_decision_outcome: actionDecisionOutcome }
        : {}),
      ...(binding_phase === "action_decision" && actionDecisionOutcome === "avoidance_wrap_up"
        ? { re_exposure_due_candidate: reExposureDueCandidate }
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
      nextMeta.intervention_sensitivity_escalation = reExposureDueCandidate;
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
    if (reExposureDueCandidate) {
      const serviceSupabase = getSupabaseAdmin();
      if (!serviceSupabase) {
        const out = NextResponse.json(
          { error: "service_role_missing_for_reexposure_pending_outcome" },
          { status: 500 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
      const ensured = await ensureNoChangeReexposurePendingOutcome({
        serviceSupabase,
        userId: user.id,
        dbScenarioId: db_scenario_id,
        jsonScenarioId: json_scenario_id,
        jsonChoiceId: json_choice_id,
        seed: reExposureSeed,
      });
      if (ensured.error) {
        console.error("[BTY REEXPOSURE] pending_outcome_ensure_failed", {
          run_id,
          user_id: user.id,
          db_scenario_id,
          json_scenario_id,
          error: ensured.error,
        });
      }
      reExposurePendingOutcomeId = ensured.pendingOutcomeId;
      if (!reExposurePendingOutcomeId) {
        const out = NextResponse.json(
          { error: "no_change_reexposure_pending_outcome_create_failed", detail: ensured.error ?? null },
          { status: 500 },
        );
        copyCookiesAndDebug(base, out, req, true);
        return out;
      }
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

  const responseSnapshot = reExposureDueCandidate
    ? {
        ...snapshot,
        runtime_state: "REEXPOSURE_DUE" as const,
        gates: { ...snapshot.gates, next_allowed: false, choice_allowed: false },
        re_exposure: {
          due: true,
          scenario_id: json_scenario_id,
          pending_outcome_id: reExposurePendingOutcomeId,
          incident_id: reExposureSeed.incidentId,
          axis_group: reExposureSeed.axisGroup,
          axis_index: reExposureSeed.axisIndex,
          pattern_family: reExposureSeed.patternFamily,
        },
      }
    : snapshot;
  const out = NextResponse.json(enforceActionRequiredContractInvariant(responseSnapshot));
  copyCookiesAndDebug(base, out, req, true);
  return out;
}
