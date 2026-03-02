/**
 * Leadership Engine — Stage state service.
 * Applies domain getNextStage; persists via Supabase. No UI; API/orchestration only.
 * Single source: docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §1, §2.
 */

import {
  getNextStage,
  STAGE_1,
  STAGE_4,
  STAGE_NAMES,
  type Stage,
  type StageTransitionContext,
} from "@/domain/leadership-engine";
import {
  evaluateForcedReset,
  getResetDueAt,
  type ResetEvalInputs,
} from "@/domain/leadership-engine/forced-reset";

const TABLE = "leadership_engine_state" as const;

/** Row shape from DB (current_stage is 1–4; forced_reset_triggered_at set when Stage 4 forced; P5 leader track). */
export type LeadershipEngineStateRow = {
  user_id: string;
  current_stage: number;
  stage_entered_at: string;
  updated_at: string;
  forced_reset_triggered_at?: string | null;
  is_leader_track?: boolean;
  leader_approved_at?: string | null;
  leader_approver_id?: string | null;
};

/** Minimal Supabase-like client for state table (select single, upsert). Accepts real SupabaseClient. */
export type LeadershipEngineStateClient = any;

const DEFAULT_STAGE: Stage = STAGE_1;

/**
 * Fetches current stage for user. Returns default Stage 1 if no row.
 * When current stage is 4 and forced reset was triggered, returns resetDueAt (triggeredAt + 48h).
 */
export async function getLeadershipEngineState(
  supabase: LeadershipEngineStateClient,
  userId: string
): Promise<{
  currentStage: Stage;
  stageName: string;
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
}> {
  const { data } = await supabase
    .from(TABLE)
    .select("current_stage, forced_reset_triggered_at")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as LeadershipEngineStateRow | null;
  const raw = row?.current_stage;
  const currentStage: Stage =
    typeof raw === "number" && raw >= 1 && raw <= 4 ? (raw as Stage) : DEFAULT_STAGE;
  const stageName = STAGE_NAMES[currentStage];
  const forcedResetTriggeredAt =
    row?.forced_reset_triggered_at != null ? row.forced_reset_triggered_at : null;
  const resetDueAt =
    forcedResetTriggeredAt != null
      ? getResetDueAt(new Date(forcedResetTriggeredAt)).toISOString()
      : null;

  return { currentStage, stageName, forcedResetTriggeredAt, resetDueAt };
}

/**
 * Applies transition rule deterministically: getNextStage(current, context) → update if non-null.
 * Returns applied flag and current (possibly updated) stage.
 */
export async function applyStageTransition(
  supabase: LeadershipEngineStateClient,
  userId: string,
  context: StageTransitionContext
): Promise<{
  applied: boolean;
  currentStage: Stage;
  previousStage?: Stage;
  stageName: string;
}> {
  const { data } = await supabase
    .from(TABLE)
    .select("current_stage")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as LeadershipEngineStateRow | null;
  const currentStage: Stage =
    typeof row?.current_stage === "number" && row.current_stage >= 1 && row.current_stage <= 4
      ? (row.current_stage as Stage)
      : DEFAULT_STAGE;

  const nextStage = getNextStage(currentStage, context);
  if (nextStage === null) {
    return {
      applied: false,
      currentStage,
      stageName: STAGE_NAMES[currentStage],
    };
  }

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    user_id: userId,
    current_stage: nextStage,
    stage_entered_at: now,
    updated_at: now,
  };
  if (nextStage === STAGE_1) {
    payload.forced_reset_triggered_at = null;
  }
  const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: "user_id" });

  if (error) {
    return {
      applied: false,
      currentStage,
      stageName: STAGE_NAMES[currentStage],
    };
  }

  return {
    applied: true,
    currentStage: nextStage,
    previousStage: currentStage,
    stageName: STAGE_NAMES[nextStage],
  };
}

/**
 * Triggers Stage 4 (Integrity Reset) and sets forced_reset_triggered_at.
 * Call only when evaluateForcedReset(inputs).shouldTrigger is true and current stage is 3.
 * Reset cannot be permanently dismissed; due = triggeredAt + 48h.
 */
export async function triggerForcedResetToStage4(
  supabase: LeadershipEngineStateClient,
  userId: string
): Promise<{ ok: boolean }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      current_stage: STAGE_4,
      stage_entered_at: now,
      updated_at: now,
      forced_reset_triggered_at: now,
    },
    { onConflict: "user_id" }
  );
  return { ok: !error };
}

/**
 * Deterministic reset state transition handler: evaluates forced-reset conditions and,
 * if any two are met and current stage is 3, triggers Stage 4. Idempotent when already Stage 4.
 */
export async function resetStateTransitionHandler(
  supabase: LeadershipEngineStateClient,
  userId: string,
  inputs: ResetEvalInputs
): Promise<{
  triggered: boolean;
  reasons: string[];
  currentStage: Stage;
  stageName: string;
}> {
  const { data } = await supabase
    .from(TABLE)
    .select("current_stage")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as LeadershipEngineStateRow | null;
  const currentStage: Stage =
    typeof row?.current_stage === "number" && row.current_stage >= 1 && row.current_stage <= 4
      ? (row.current_stage as Stage)
      : DEFAULT_STAGE;

  const { shouldTrigger, reasons } = evaluateForcedReset(inputs);

  if (shouldTrigger && currentStage === 3) {
    const { ok } = await triggerForcedResetToStage4(supabase, userId);
    if (ok) {
      return {
        triggered: true,
        reasons,
        currentStage: STAGE_4,
        stageName: STAGE_NAMES[STAGE_4],
      };
    }
  }

  return {
    triggered: false,
    reasons,
    currentStage,
    stageName: STAGE_NAMES[currentStage],
  };
}

/**
 * Ensures a row exists for the user (default Stage 1). Idempotent.
 */
export async function ensureLeadershipEngineState(
  supabase: LeadershipEngineStateClient,
  userId: string
): Promise<void> {
  const { data } = await supabase
    .from(TABLE)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return;

  const now = new Date().toISOString();
  await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      current_stage: DEFAULT_STAGE,
      stage_entered_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
}
