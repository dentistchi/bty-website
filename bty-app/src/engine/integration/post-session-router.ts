/**
 * After {@link SessionSummaryOverlay} dismiss — orchestrates Foundry prefetch, avatar unlock UX,
 * next scenario with optional `INTEGRITY_SLIP` bias (negative AIR), and easy-tier lock when
 * {@link getAIRTrend} reports sustained decline (same rule as `air_trend_warning`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scenario } from "@/lib/bty/scenario/types";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getUnlockedAssets } from "@/engine/avatar/avatar-state.service";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getRecommendations, type ProgramRecommendation } from "@/engine/foundry/program-recommender.service";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { type ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";

/** DB / catalog `flag_type` for integrity-slip recovery scenarios. */
export const POST_SESSION_INTEGRITY_SLIP_FLAG = "INTEGRITY_SLIP" as const;

/** Same threshold as `air_trend_warning` broadcast in {@link getAIRTrend}. */
export const AIR_TREND_WARNING_MIN_DECLINING_STEPS = 3 as const;

export type PostSessionDismissalKind = "next_scenario" | "foundry_redirect";

export type SessionOutcome = {
  dismissal: PostSessionDismissalKind;
  locale: ScenarioLocalePreference;
  foundryUnlockFired: boolean;
  avatarTierUpgradedFired: boolean;
  /** AIR Δ from the completed session; negative biases next scenario toward {@link POST_SESSION_INTEGRITY_SLIP_FLAG}. */
  airDelta: number;
};

export type PostSessionRoute = {
  recommendations: ProgramRecommendation[] | null;
  /** Top ranked program id for `router.prefetch` / warm navigation. */
  prefetchProgramId: string | null;
  unlockedAssets: string[] | null;
  /** Client should show an avatar unlock toast (tier upgrade path). */
  queueAvatarUnlockToast: boolean;
  /** True when negative AIR led to passing `preferFlagType: INTEGRITY_SLIP` into {@link selectNextScenario}. */
  recoveryBiasApplied: boolean;
  /** True when rolling AIR trend meets the `air_trend_warning` rule (≥3 declining rolling steps). */
  airTrendWarningActive: boolean;
  /** True when {@link airTrendWarningActive} led to `forceDifficultyTier: 1` for next scenario selection. */
  forcedDifficultyOneApplied: boolean;
  /** Set when `dismissal === "next_scenario"` — selected next scenario for the shell. */
  nextScenario: Scenario | null;
};

export async function routePostSession(
  userId: string,
  outcome: SessionOutcome,
  supabase?: SupabaseClient,
): Promise<PostSessionRoute> {
  const client = supabase ?? (await getSupabaseServerClient());

  let recommendations: ProgramRecommendation[] | null = null;
  let prefetchProgramId: string | null = null;
  if (outcome.foundryUnlockFired) {
    recommendations = await getRecommendations(userId, client);
    prefetchProgramId = recommendations[0]?.program_id ?? null;
  }

  let unlockedAssets: string[] | null = null;
  let queueAvatarUnlockToast = false;
  if (outcome.avatarTierUpgradedFired) {
    unlockedAssets = await getUnlockedAssets(userId, client);
    queueAvatarUnlockToast = true;
  }

  let nextScenario: Scenario | null = null;
  let recoveryBiasApplied = false;
  let airTrendWarningActive = false;
  let forcedDifficultyOneApplied = false;

  if (outcome.dismissal === "next_scenario") {
    const trend = await getAIRTrend(userId, { emitWarning: false });
    airTrendWarningActive = trend.consecutiveDecliningRollingSteps >= AIR_TREND_WARNING_MIN_DECLINING_STEPS;
    forcedDifficultyOneApplied = airTrendWarningActive;

    const negativeAir = outcome.airDelta < 0;
    recoveryBiasApplied = negativeAir;

    const routed = await getNextScenarioForSession(userId, outcome.locale, {
      preferFlagType: negativeAir ? POST_SESSION_INTEGRITY_SLIP_FLAG : undefined,
      forceDifficultyTier: airTrendWarningActive ? 1 : undefined,
    });
    nextScenario = routed?.scenario ?? null;
  }

  return {
    recommendations,
    prefetchProgramId,
    unlockedAssets,
    queueAvatarUnlockToast,
    recoveryBiasApplied,
    airTrendWarningActive,
    forcedDifficultyOneApplied,
    nextScenario,
  };
}
