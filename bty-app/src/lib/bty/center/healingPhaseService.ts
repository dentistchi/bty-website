/**
 * Center Healing Journey — DB + domain wiring for `getCurrentPhase` / advance.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AwakeningActId } from "@/domain/healing";
import {
  type CenterHealingPhaseInputs,
  type HealingJourneyPhaseId,
  normalizeStoredHealingPhase,
  phaseCompletionCriteriaMet,
} from "@/domain/center/healingPhase";
import { getAssessmentHistory } from "./assessmentService";
import { getLetterHistory } from "./letterService";
import { getUserCompletedAwakeningActs } from "@/lib/bty/healing/getUserCompletedAwakeningActs";

export type HealingPhaseTrackerState = {
  activePhase: HealingJourneyPhaseId;
  inputs: CenterHealingPhaseInputs;
  /** True when user may POST advance (criteria for active phase met and not yet at terminal advance). */
  canAdvance: boolean;
  /** Per-phase: diagnostics for that phase satisfied (for stepper styling / copy). */
  phaseComplete: Record<HealingJourneyPhaseId, boolean>;
};

async function fetchCenterInputs(
  supabase: SupabaseClient,
  userId: string
): Promise<CenterHealingPhaseInputs | { error: string }> {
  const [hist, letters, acts] = await Promise.all([
    getAssessmentHistory(supabase, userId, 50),
    getLetterHistory(supabase, userId, 50),
    getUserCompletedAwakeningActs(supabase, userId),
  ]);

  if (!hist.ok) return { error: hist.error };
  if (!letters.ok) return { error: letters.error };
  if (!acts.ok) return { error: acts.error };

  return {
    assessmentSubmissionCount: hist.submissions.length,
    dearMeLetterCount: letters.letters.length,
    completedAwakeningActIds: acts.completedActs,
  };
}

async function ensureJourneyRow(
  supabase: SupabaseClient,
  userId: string
): Promise<{ active_phase: number } | { error: string }> {
  const { data: existing, error: selErr } = await supabase
    .from("user_center_healing_journey")
    .select("active_phase")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) return { error: selErr.message };
  if (existing) return { active_phase: Number((existing as { active_phase: number }).active_phase) };

  const { data: inserted, error: insErr } = await supabase
    .from("user_center_healing_journey")
    .insert({ user_id: userId, active_phase: 1 })
    .select("active_phase")
    .single();

  if (insErr) return { error: insErr.message };
  return { active_phase: Number((inserted as { active_phase: number }).active_phase) };
}

/**
 * Current stored phase (1–4) for the user. Creates default row when missing.
 */
export async function getCurrentPhase(
  supabase: SupabaseClient,
  userId: string
): Promise<HealingJourneyPhaseId | { error: string }> {
  const row = await ensureJourneyRow(supabase, userId);
  if ("error" in row) return row;
  return normalizeStoredHealingPhase(row.active_phase);
}

export async function getHealingPhaseTrackerState(
  supabase: SupabaseClient,
  userId: string
): Promise<HealingPhaseTrackerState | { error: string }> {
  const inputs = await fetchCenterInputs(supabase, userId);
  if ("error" in inputs) return inputs;

  const row = await ensureJourneyRow(supabase, userId);
  if ("error" in row) return row;

  const activePhase = normalizeStoredHealingPhase(row.active_phase);

  const phaseComplete = {
    1: phaseCompletionCriteriaMet(1, inputs),
    2: phaseCompletionCriteriaMet(2, inputs),
    3: phaseCompletionCriteriaMet(3, inputs),
    4: phaseCompletionCriteriaMet(4, inputs),
  } as Record<HealingJourneyPhaseId, boolean>;

  const criteriaForActive = phaseCompletionCriteriaMet(activePhase, inputs);
  const canAdvance = criteriaForActive && activePhase < 4;

  return {
    activePhase,
    inputs,
    canAdvance,
    phaseComplete,
  };
}

/**
 * Resets the Center healing journey to Phase 1. Called when Arena ejects the user to Center again.
 */
export async function resetHealingJourney(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("user_center_healing_journey")
    .upsert(
      { user_id: userId, active_phase: 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function advanceHealingPhase(
  supabase: SupabaseClient,
  userId: string
): Promise<
  | { ok: true; previousPhase: HealingJourneyPhaseId; newPhase: HealingJourneyPhaseId }
  | { ok: false; error: "CRITERIA_NOT_MET" | "ALREADY_COMPLETE" | string }
> {
  const state = await getHealingPhaseTrackerState(supabase, userId);
  if ("error" in state) return { ok: false, error: state.error };

  if (state.activePhase >= 4) {
    return { ok: false, error: "ALREADY_COMPLETE" };
  }
  if (!phaseCompletionCriteriaMet(state.activePhase, state.inputs)) {
    return { ok: false, error: "CRITERIA_NOT_MET" };
  }

  const newPhase = (state.activePhase + 1) as HealingJourneyPhaseId;
  const { error: upErr } = await supabase
    .from("user_center_healing_journey")
    .update({ active_phase: newPhase, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, previousPhase: state.activePhase, newPhase };
}
