/**
 * Single snapshot for promotion / Elite flows: LRI, certified leader, AIR trend, scenario engagement,
 * plus gating when Arena ejected or recent integrity slip.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIRTrend, type AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import { getCertifiedStatus, type CertifiedLeaderStatus } from "@/engine/integrity/certified-leader.monitor";
import { getLRI } from "@/engine/integrity/lri-calculator.service";
import type { ScenarioLocalePreference } from "@/engine/scenario/scenario-selector.service";
import { getScenarioStats, type ScenarioStats } from "@/engine/scenario/scenario-stats.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 86_400_000;

/** Normalize streak days into [0, 1] for `readiness_score` (caps runaway weight). */
export const PROMOTION_STREAK_DAYS_CAP = 30 as const;

export type PromotionReadiness = {
  userId: string;
  computedAt: string;
  /** `(lri * 0.5) + (streakNorm * 0.2) + (completion_rate * 0.3)` with streakNorm = min(1, streak/CAP). */
  readiness_score: number;
  promotion_blocked: boolean;
  /** Non-empty when `promotion_blocked` (e.g. `ejected`, `integrity_slip_7d`). */
  block_reasons: string[];
  lri: number;
  lri_promotion_ready: boolean;
  certified: CertifiedLeaderStatus;
  air_trend_direction: AIRTrendDirection;
  scenario_stats: ScenarioStats;
  /** Sub-scores used in readiness_score (all in [0, 1]). */
  score_inputs: {
    lri: number;
    streak_days_raw: number;
    streak_norm: number;
    completion_rate: number;
  };
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function streakNorm(streakDays: number): number {
  return clamp01(streakDays / PROMOTION_STREAK_DAYS_CAP);
}

function computeReadinessScore(lri: number, streakDays: number, completionRate: number): number {
  const s = streakNorm(streakDays);
  const cr = clamp01(completionRate);
  const l = clamp01(lri);
  return clamp01(l * 0.5 + s * 0.2 + cr * 0.3);
}

async function fetchArenaStatus(
  userId: string,
  client: SupabaseClient | null,
): Promise<"ACTIVE" | "EJECTED" | null> {
  if (!client) return null;
  const { data, error } = await client
    .from("arena_profiles")
    .select("arena_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const s = (data as { arena_status?: string }).arena_status;
  return s === "EJECTED" ? "EJECTED" : s === "ACTIVE" ? "ACTIVE" : null;
}

/**
 * Any `integrity_slip_log` row in the last 7 UTC days counts as “active slip” for this gate.
 */
export async function hasIntegritySlipWithin7Days(
  userId: string,
  options?: { now?: Date; supabase?: SupabaseClient },
): Promise<boolean> {
  const client = options?.supabase ?? getSupabaseAdmin();
  if (!client) return false;

  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - 7 * MS_PER_DAY).toISOString();

  const { data, error } = await client
    .from("integrity_slip_log")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return data != null;
}

/**
 * Aggregates LRI, certified status, AIR trend, scenario stats; applies promotion block rules.
 */
export async function getPromotionReadiness(
  userId: string,
  options?: { now?: Date; supabase?: SupabaseClient; locale?: ScenarioLocalePreference },
): Promise<PromotionReadiness> {
  const now = options?.now ?? new Date();
  const computedAt = now.toISOString();
  const locale = options?.locale ?? "en";
  const admin = options?.supabase ?? getSupabaseAdmin();

  const [lriSnap, certified, airTrend, scenarioStats, arenaStatus, slip7d] = await Promise.all([
    getLRI(userId).catch(() => null),
    getCertifiedStatus(userId),
    getAIRTrend(userId, { now }),
    getScenarioStats(userId, locale),
    fetchArenaStatus(userId, admin),
    hasIntegritySlipWithin7Days(userId, { now, supabase: admin ?? undefined }),
  ]);

  let lri = 0;
  let lri_promotion_ready = false;
  if (lriSnap) {
    lri = clamp01(lriSnap.lri);
    lri_promotion_ready = Boolean(lriSnap.promotion_ready);
  }

  const streak_days_raw = scenarioStats.streakDaysUtc;
  const readiness_score = computeReadinessScore(lri, streak_days_raw, scenarioStats.completionRate);

  const block_reasons: string[] = [];
  if (arenaStatus === "EJECTED") block_reasons.push("ejected");
  if (slip7d) block_reasons.push("integrity_slip_7d");

  const promotion_blocked = block_reasons.length > 0;

  return {
    userId,
    computedAt,
    readiness_score,
    promotion_blocked,
    block_reasons,
    lri,
    lri_promotion_ready,
    certified,
    air_trend_direction: airTrend.direction,
    scenario_stats: scenarioStats,
    score_inputs: {
      lri,
      streak_days_raw,
      streak_norm: streakNorm(streak_days_raw),
      completion_rate: clamp01(scenarioStats.completionRate),
    },
  };
}
