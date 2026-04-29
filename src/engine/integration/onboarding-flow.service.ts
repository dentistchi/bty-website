/**
 * Five-step onboarding: locale → role/level → first Arena (beginner) → AIR baseline → Foundry path.
 * Persisted in {@link user_onboarding_progress}; step 5 finale runs catalog sync, learning path, difficulty floor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getRecommendations,
  refreshFoundryProgramRecommendations,
} from "@/engine/foundry/program-recommender.service";
import { recordProgramSelected } from "@/engine/foundry/program-completion.service";
import { syncCatalogToDB } from "@/engine/scenario/scenario-catalog-sync.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { ONBOARDING_COMPLETE_EVENT } from "./onboarding-flow.constants";

export { ONBOARDING_COMPLETE_EVENT };

export const ONBOARDING_STEP_COUNT = 5 as const;

export const ONBOARDING_STEPS = [1, 2, 3, 4, 5] as const;

export type OnboardingStepNumber = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  userId: string;
  /** Next step the user must complete (1–5), or `null` when finished. */
  nextStep: OnboardingStepNumber | null;
  /** Highest step completed (0 = none, 5 = all). */
  highestCompleted: number;
  isComplete: boolean;
  completedAt: string | null;
};

export type OnboardingCompletePayload = {
  event: typeof ONBOARDING_COMPLETE_EVENT;
  userId: string;
  /** Assigned Foundry program after step 5, if any. */
  programId: string | null;
  completedAt: string;
};

const completeListeners = new Set<(p: OnboardingCompletePayload) => void | Promise<void>>();

export function onOnboardingComplete(
  fn: (p: OnboardingCompletePayload) => void | Promise<void>,
): () => void {
  completeListeners.add(fn);
  return () => completeListeners.delete(fn);
}

function emitOnboardingComplete(p: OnboardingCompletePayload): void {
  for (const fn of completeListeners) {
    try {
      void fn(p);
    } catch {
      /* no-op */
    }
  }
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function stateFromRow(userId: string, stepCompleted: number, completedAt: string | null): OnboardingState {
  const highest = Math.min(5, Math.max(0, stepCompleted));
  const isComplete = highest >= ONBOARDING_STEP_COUNT;
  return {
    userId,
    highestCompleted: highest,
    nextStep: isComplete ? null : ((highest + 1) as OnboardingStepNumber),
    isComplete,
    completedAt,
  };
}

/**
 * Current onboarding snapshot for gating Arena / Foundry / Center until {@link OnboardingState.isComplete}.
 */
export async function getOnboardingStep(userId: string, supabase?: SupabaseClient): Promise<OnboardingState> {
  const client = resolveClient(supabase);
  if (!client) {
    throw new Error(
      "getOnboardingStep: pass supabase from a route (getSupabaseServerClient) or use service role (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  const { data, error } = await client
    .from("user_onboarding_progress")
    .select("step_completed, completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getOnboardingStep: ${error.message}`);
  if (!data) {
    return stateFromRow(userId, 0, null);
  }
  const row = data as { step_completed?: unknown; completed_at?: unknown };
  const sc = typeof row.step_completed === "number" ? row.step_completed : Number(row.step_completed ?? 0);
  const completedAt =
    row.completed_at == null
      ? null
      : typeof row.completed_at === "string"
        ? row.completed_at
        : String(row.completed_at);
  return stateFromRow(userId, Number.isFinite(sc) ? sc : 0, completedAt);
}

/**
 * Top ranked Foundry program for the user after refreshing recommendations.
 */
export async function getActiveLearningPath(
  userId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = resolveClient(supabase);
  if (!client) return null;
  await refreshFoundryProgramRecommendations(userId, client);
  const recs = await getRecommendations(userId, client);
  if (!recs.length) return null;
  const sorted = [...recs].sort((a, b) => a.rank - b.rank);
  return sorted[0]?.program_id ?? null;
}

/**
 * Assigns the active Foundry program (starts `user_program_progress` for that program).
 */
export async function setLearningPath(
  userId: string,
  programId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  await recordProgramSelected(userId, programId, supabase);
}

async function upsertProgress(
  userId: string,
  stepCompleted: number,
  supabase: SupabaseClient,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_onboarding_progress").upsert(
    { user_id: userId, step_completed: stepCompleted, completed_at: now },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`user_onboarding_progress: ${error.message}`);
}

async function initDifficultyFloorTo1(userId: string, supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_difficulty_profile").upsert(
    { user_id: userId, difficulty_floor: 1, updated_at: now },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`initDifficultyFloorTo1: ${error.message}`);
}

async function runOnboardingStep5Finale(userId: string, supabase: SupabaseClient): Promise<{
  programId: string | null;
}> {
  await syncCatalogToDB();
  const programId = await getActiveLearningPath(userId, supabase);
  if (programId) {
    await setLearningPath(userId, programId, supabase);
  }
  await initDifficultyFloorTo1(userId, supabase);
  return { programId };
}

/**
 * Marks a single step complete (must be the next step in order). Step 5 runs finale + emits {@link ONBOARDING_COMPLETE_EVENT}.
 */
export async function markOnboardingStepComplete(
  userId: string,
  step: OnboardingStepNumber,
  supabase?: SupabaseClient,
): Promise<OnboardingState> {
  const client = resolveClient(supabase);
  if (!client) throw new Error("markOnboardingStepComplete: Supabase client not available");

  const before = await getOnboardingStep(userId, client);
  if (before.isComplete) return before;
  if (before.nextStep !== step) {
    throw new Error(`Onboarding: expected step ${before.nextStep}, got ${step}`);
  }

  await upsertProgress(userId, step, client);

  if (step === ONBOARDING_STEP_COUNT) {
    const { programId } = await runOnboardingStep5Finale(userId, client);
    const completedAt = new Date().toISOString();
    emitOnboardingComplete({
      event: ONBOARDING_COMPLETE_EVENT,
      userId,
      programId,
      completedAt,
    });
  }

  return getOnboardingStep(userId, client);
}
