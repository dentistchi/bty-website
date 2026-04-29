/**
 * Re-exposure → pattern-shift validation (server authority).
 * Same-axis only: `run.scenario_id` must match the delayed-outcome source `scenario_id`.
 *
 * @see domain/leadership-engine/patternShift.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";
import { patternShiftBandFromReexposure } from "@/domain/leadership-engine/patternShift";
import { getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";

export type ReexposureValidationCommitment = "commit" | "avoid" | "unknown";

export type ReexposureValidationPayload = {
  scenario_id: string;
  before_axis: string;
  before_pattern_family: string | null;
  before_second_choice_direction: "entry" | "exit" | null;
  before_exit_pattern_key: string;
  action_decision_commitment: ReexposureValidationCommitment;
  after_axis: string;
  after_pattern_family: string | null;
  after_second_choice_direction: "entry" | "exit" | null;
  after_exit_pattern_key: string;
  validation_result: PatternShiftBand;
  axis_guard: "same_axis_ok";
  prior_run_id: string | null;
  reexposure_run_id: string;
  recorded_at: string;
};

type SecondChoiceEventRow = {
  choice_id: string | null;
  meta: Record<string, unknown> | null;
};

function metaDirection(m: Record<string, unknown> | null | undefined): "entry" | "exit" | null {
  const d = m && typeof m.direction === "string" ? m.direction.toLowerCase() : "";
  if (d === "entry" || d === "exit") return d;
  return null;
}

function metaPatternFamily(m: Record<string, unknown> | null | undefined): string | null {
  const raw = m && typeof m.pattern_family === "string" ? m.pattern_family.trim() : "";
  return raw !== "" ? raw : null;
}

function metaIntensity(m: Record<string, unknown> | null | undefined): 1 | 2 | 3 | null {
  const v = m && typeof m.intensity === "number" ? m.intensity : null;
  if (v === 1 || v === 2 || v === 3) return v;
  return null;
}

export async function fetchSecondChoiceConfirmedRow(
  supabase: SupabaseClient,
  runId: string,
): Promise<{ choice_id: string; direction: "entry" | "exit"; pattern_family: string | null; intensity: 1 | 2 | 3 | null } | null> {
  const { data, error } = await supabase
    .from("arena_events")
    .select("choice_id, meta")
    .eq("run_id", runId)
    .eq("step", 4)
    .eq("event_type", "SECOND_CHOICE_CONFIRMED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as SecondChoiceEventRow;
  const choiceId = typeof row.choice_id === "string" && row.choice_id.trim() !== "" ? row.choice_id.trim() : null;
  if (!choiceId) return null;
  const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : null;
  const direction = metaDirection(meta);
  if (!direction) return null;
  return {
    choice_id: choiceId,
    direction,
    pattern_family: metaPatternFamily(meta),
    intensity: metaIntensity(meta),
  };
}

type PatternSignalExitRow = {
  pattern_family: string;
  payload: Record<string, unknown> | null;
};

export async function fetchExitPatternSignalForRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<PatternSignalExitRow | null> {
  const { data, error } = await supabase
    .from("pattern_signals")
    .select("pattern_family, payload, direction, step")
    .eq("run_id", runId)
    .eq("step", 4)
    .eq("direction", "exit")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as PatternSignalExitRow & { direction?: string; step?: number };
  const fam = typeof row.pattern_family === "string" ? row.pattern_family.trim() : "";
  if (!fam) return null;
  const payload =
    row.payload != null && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : null;
  return { pattern_family: fam, payload };
}

export async function fetchActionDecisionCommitment(
  supabase: SupabaseClient,
  runId: string,
): Promise<ReexposureValidationCommitment> {
  const { data, error } = await supabase
    .from("arena_events")
    .select("meta")
    .eq("run_id", runId)
    .eq("event_type", "BINDING_V1_ACTION_DECISION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return "unknown";
  const meta = (data as { meta?: unknown }).meta;
  const m = meta != null && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
  const raw = m && typeof m.action_decision_outcome === "string" ? m.action_decision_outcome : "";
  if (raw === "commitment_contract") return "commit";
  if (raw === "avoidance_wrap_up") return "avoid";
  return "unknown";
}

function buildExitPatternKey(params: {
  direction: "entry" | "exit";
  choiceId: string;
  patternFamily: string | null;
  exitSignal: PatternSignalExitRow | null;
}): string {
  if (params.direction === "entry") return `entry:${params.choiceId}`;
  if (params.exitSignal) {
    const sid =
      params.exitSignal.payload && typeof params.exitSignal.payload.second_choice_id === "string"
        ? params.exitSignal.payload.second_choice_id.trim()
        : params.choiceId;
    return `${params.exitSignal.pattern_family}|${sid}`;
  }
  const fam = params.patternFamily?.trim() ?? "";
  return `${fam}|${params.choiceId}`;
}

export async function resolvePriorRunIdForReexposure(params: {
  supabase: SupabaseClient;
  userId: string;
  scenarioId: string;
  reexposureRunId: string;
}): Promise<string | null> {
  const { data, error } = await params.supabase
    .from("arena_runs")
    .select("run_id, started_at")
    .eq("user_id", params.userId)
    .eq("scenario_id", params.scenarioId)
    .neq("run_id", params.reexposureRunId)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  const id = (data[0] as { run_id?: string }).run_id;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

/**
 * Computes pattern-shift band from prior baseline run vs current re-exposure run (tradeoff / step 4).
 */
export async function computeReexposureValidation(params: {
  supabase: SupabaseClient;
  userId: string;
  scenarioId: string;
  reexposureRunId: string;
}): Promise<
  | { ok: true; payload: ReexposureValidationPayload }
  | { ok: false; error: string; fallback_result: PatternShiftBand }
> {
  const priorRunId = await resolvePriorRunIdForReexposure({
    supabase: params.supabase,
    userId: params.userId,
    scenarioId: params.scenarioId,
    reexposureRunId: params.reexposureRunId,
  });

  let elite;
  try {
    elite = getEliteScenarioById(params.scenarioId);
  } catch {
    return { ok: false, error: "elite_scenario_unknown", fallback_result: "unstable" };
  }
  const axis = typeof elite.bty_tension_axis === "string" ? elite.bty_tension_axis.trim() : "";
  if (!axis) {
    return { ok: false, error: "elite_axis_missing", fallback_result: "unstable" };
  }

  const afterEv = await fetchSecondChoiceConfirmedRow(params.supabase, params.reexposureRunId);
  const afterSig =
    afterEv?.direction === "exit"
      ? await fetchExitPatternSignalForRun(params.supabase, params.reexposureRunId)
      : null;

  if (!afterEv) {
    const recorded_at = new Date().toISOString();
    return {
      ok: true,
      payload: {
        scenario_id: params.scenarioId,
        before_axis: axis,
        before_pattern_family: null,
        before_second_choice_direction: null,
        before_exit_pattern_key: "",
        action_decision_commitment: "unknown",
        after_axis: axis,
        after_pattern_family: null,
        after_second_choice_direction: null,
        after_exit_pattern_key: "",
        validation_result: "unstable",
        axis_guard: "same_axis_ok",
        prior_run_id: priorRunId,
        reexposure_run_id: params.reexposureRunId,
        recorded_at,
      },
    };
  }

  const afterKey = buildExitPatternKey({
    direction: afterEv.direction,
    choiceId: afterEv.choice_id,
    patternFamily: afterEv.pattern_family,
    exitSignal: afterSig,
  });

  if (!priorRunId) {
    const recorded_at = new Date().toISOString();
    return {
      ok: true,
      payload: {
        scenario_id: params.scenarioId,
        before_axis: axis,
        before_pattern_family: null,
        before_second_choice_direction: null,
        before_exit_pattern_key: "",
        action_decision_commitment: "unknown",
        after_axis: axis,
        after_pattern_family: afterEv.pattern_family,
        after_second_choice_direction: afterEv.direction,
        after_exit_pattern_key: afterKey,
        validation_result: "unstable",
        axis_guard: "same_axis_ok",
        prior_run_id: null,
        reexposure_run_id: params.reexposureRunId,
        recorded_at,
      },
    };
  }

  const priorEv = await fetchSecondChoiceConfirmedRow(params.supabase, priorRunId);
  const priorSig =
    priorEv?.direction === "exit"
      ? await fetchExitPatternSignalForRun(params.supabase, priorRunId)
      : null;
  const commitment = await fetchActionDecisionCommitment(params.supabase, priorRunId);

  if (!priorEv) {
    const recorded_at = new Date().toISOString();
    return {
      ok: true,
      payload: {
        scenario_id: params.scenarioId,
        before_axis: axis,
        before_pattern_family: null,
        before_second_choice_direction: null,
        before_exit_pattern_key: "",
        action_decision_commitment: commitment,
        after_axis: axis,
        after_pattern_family: afterEv.pattern_family,
        after_second_choice_direction: afterEv.direction,
        after_exit_pattern_key: afterKey,
        validation_result: "unstable",
        axis_guard: "same_axis_ok",
        prior_run_id: priorRunId,
        reexposure_run_id: params.reexposureRunId,
        recorded_at,
      },
    };
  }

  const priorKey = buildExitPatternKey({
    direction: priorEv.direction,
    choiceId: priorEv.choice_id,
    patternFamily: priorEv.pattern_family,
    exitSignal: priorSig,
  });

  const reentryAsEntry = priorEv.direction === "exit" && afterEv.direction === "entry";
  // intensity decrease: prior had a value AND after is strictly lower
  const priorIntensity = priorEv.intensity;
  const afterIntensity = afterEv.intensity;
  const intensityDecreased =
    priorIntensity != null && afterIntensity != null && afterIntensity < priorIntensity;
  const band = patternShiftBandFromReexposure({
    reentryAsEntry,
    priorExitPatternKey: priorKey,
    afterExitPatternKey: afterKey,
    intensityDecreased,
  });

  const recorded_at = new Date().toISOString();
  return {
    ok: true,
    payload: {
      scenario_id: params.scenarioId,
      before_axis: axis,
      before_pattern_family: priorEv.pattern_family,
      before_second_choice_direction: priorEv.direction,
      before_exit_pattern_key: priorKey,
      action_decision_commitment: commitment,
      after_axis: axis,
      after_pattern_family: afterEv.pattern_family,
      after_second_choice_direction: afterEv.direction,
      after_exit_pattern_key: afterKey,
      validation_result: band,
      axis_guard: "same_axis_ok",
      prior_run_id: priorRunId,
      reexposure_run_id: params.reexposureRunId,
      recorded_at,
    },
  };
}
