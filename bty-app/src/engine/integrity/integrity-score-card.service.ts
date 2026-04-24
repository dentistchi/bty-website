/**
 * User-facing integrity score card: weighted AIR (40%) + LRI (30%) + resilience (30%), grade A–D,
 * persisted to `integrity_score_cards`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIRBand } from "@/domain/leadership-engine/air";
import type { AIRTrend, AIRTrendDirection } from "@/engine/integrity/air-trend.service";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getBehaviorPatterns, type BehaviorPattern } from "@/engine/integrity/behavior-pattern.service";
import {
  getRenewalHistory,
  type RenewalHistory,
} from "@/engine/integrity/certification-renewal.service";
import { getCertifiedStatus, type CertifiedLeaderStatus } from "@/engine/integrity/certified-leader.monitor";
import { getLRI, type LRIResult } from "@/engine/integrity/lri-calculator.service";
import {
  getAnimationStats,
  resiliencePenaltyFromIntegritySlipAnimations,
  type AnimationStats,
} from "@/engine/avatar/avatar-animation-log.service";
import { getResilienceScore, type ResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const W_AIR = 0.4 as const;
const W_LRI = 0.3 as const;
const W_RES = 0.3 as const;

export type IntegrityGrade = "A" | "B" | "C" | "D";

export type IntegrityScoreCardComponentPayload = {
  weights: { air: typeof W_AIR; lri: typeof W_LRI; resilience: typeof W_RES };
  compositeScore: number;
  airPct: number;
  lriPct: number;
  resiliencePct: number;
  airTrend: {
    direction: AIRTrendDirection;
    last7DayWindowAvg: number;
    last7DayWindowBand: AIRBand;
    prior7DayWindowAvg: number;
  };
  lriRaw: number | null;
  lriPromotionReady: boolean | null;
  resilience: Pick<
    ResilienceScore,
    | "score"
    | "consecutive_clean_choices"
    | "recovery_speed_component"
    | "center_phase_completions"
    | "computed_at"
  >;
  behaviorPatternTypes: string[];
  certified: CertifiedLeaderStatus;
  renewalHistory: {
    count: number;
    renewedCount: number;
    lastAttemptedAt: string | null;
  };
  /** INTEGRITY_SLIP avatar animation plays in the last 30 days (behavioral signal). */
  avatarAnimationIntegritySlipCount30d: number;
  /** Subtracted from raw resilience before composite when slip animations are frequent. */
  resiliencePenaltyFromAvatarAnimations: number;
};

export type IntegrityScoreCard = {
  userId: string;
  computedAt: string;
  /** Weighted 0–100 composite before letter grade. */
  compositeScore: number;
  overall_integrity_grade: IntegrityGrade;
  grade: IntegrityGrade;
  report: IntegrityScoreCardComponentPayload;
};

export type IntegrityScoreCardReuse = {
  lri?: LRIResult | null;
  airTrend?: AIRTrend;
  resilience?: ResilienceScore;
  behaviorPatterns?: BehaviorPattern[];
  certified?: CertifiedLeaderStatus;
  renewalHistory?: RenewalHistory[];
  animationStats30d?: AnimationStats | null;
};

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function gradeFromComposite(composite: number): IntegrityGrade {
  const x = clamp100(composite);
  if (x >= 90) return "A";
  if (x >= 75) return "B";
  if (x >= 60) return "C";
  return "D";
}

function airPctFromTrend(t: AIRTrend): number {
  const v = t.last7DayWindowAvg;
  if (!Number.isFinite(v)) return 0;
  return clamp100(v * 100);
}

function lriPctFromResult(lri: LRIResult | null): { pct: number; raw: number | null; promotionReady: boolean | null } {
  if (!lri || !Number.isFinite(lri.lri)) return { pct: 0, raw: null, promotionReady: null };
  return {
    pct: clamp100(lri.lri * 100),
    raw: lri.lri,
    promotionReady: lri.promotion_ready,
  };
}

function renewalSummary(rows: RenewalHistory[]): {
  count: number;
  renewedCount: number;
  lastAttemptedAt: string | null;
} {
  let renewedCount = 0;
  for (const r of rows) {
    if (r.renewed) renewedCount += 1;
  }
  const last = rows.length
    ? rows.reduce((a, b) => (a.attemptedAt >= b.attemptedAt ? a : b)).attemptedAt
    : null;
  return { count: rows.length, renewedCount, lastAttemptedAt: last };
}

function certifiedToJson(c: CertifiedLeaderStatus): Record<string, unknown> {
  return c.state === "none"
    ? { state: "none" as const }
    : {
        state: c.state,
        grantId: c.grantId,
        grantedAt: c.grantedAt,
        expiresAt: c.expiresAt,
      };
}

/**
 * Persists to `integrity_score_cards` only when `auth.admin.getUserById` confirms `userId` exists
 * (FK target). If the user is missing, logs `skipping persist: auth user not found` and returns
 * without throwing. Other lookup errors fall through to upsert (caller may catch DB errors).
 */
export async function persistIntegrityScoreCard(
  admin: SupabaseClient,
  userId: string,
  grade: IntegrityGrade,
  computedAtIso: string,
  componentScores: Record<string, unknown>,
): Promise<void> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("user not found") || msg.includes("not found")) {
        console.warn("skipping persist: auth user not found", userId);
        return;
      }
    } else if (!data?.user?.id) {
      console.warn("skipping persist: auth user not found", userId);
      return;
    }
  } catch {
    /* No admin API — skip persist (cannot verify auth.users; avoids FK throw in smoke). */
    console.warn("skipping persist: auth user not found", userId);
    return;
  }

  const { error } = await admin.from("integrity_score_cards").upsert(
    {
      user_id: userId,
      grade,
      computed_at: computedAtIso,
      component_scores: componentScores,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`persistIntegrityScoreCard: ${error.message}`);
}

function buildPayload(
  userId: string,
  computedAt: string,
  airTrend: AIRTrend,
  lri: LRIResult | null,
  resilience: ResilienceScore,
  patterns: BehaviorPattern[],
  certified: CertifiedLeaderStatus,
  renewalRows: RenewalHistory[],
  animationStats30d: AnimationStats | null,
): { card: IntegrityScoreCard; componentScoresJson: Record<string, unknown> } {
  const airPct = airPctFromTrend(airTrend);
  const { pct: lriPct, raw: lriRaw, promotionReady: lriPromotionReady } = lriPctFromResult(lri);
  const slipAnimCount = animationStats30d?.INTEGRITY_SLIP ?? 0;
  const resiliencePenaltyFromAvatarAnimations = animationStats30d
    ? resiliencePenaltyFromIntegritySlipAnimations(animationStats30d)
    : 0;
  const resilienceScoreAdjusted = Math.max(
    0,
    Math.min(100, resilience.score - resiliencePenaltyFromAvatarAnimations),
  );
  const resiliencePct = clamp100(resilienceScoreAdjusted);

  const compositeScore = clamp100(W_AIR * airPct + W_LRI * lriPct + W_RES * resiliencePct);
  const grade = gradeFromComposite(compositeScore);

  const renewalHistory = renewalSummary(renewalRows);
  const behaviorPatternTypes = patterns.map((p) => p.pattern_type);

  const report: IntegrityScoreCardComponentPayload = {
    weights: { air: W_AIR, lri: W_LRI, resilience: W_RES },
    compositeScore,
    airPct,
    lriPct,
    resiliencePct,
    airTrend: {
      direction: airTrend.direction,
      last7DayWindowAvg: airTrend.last7DayWindowAvg,
      last7DayWindowBand: airTrend.last7DayWindowBand,
      prior7DayWindowAvg: airTrend.prior7DayWindowAvg,
    },
    lriRaw,
    lriPromotionReady,
    resilience: {
      score: resilienceScoreAdjusted,
      consecutive_clean_choices: resilience.consecutive_clean_choices,
      recovery_speed_component: resilience.recovery_speed_component,
      center_phase_completions: resilience.center_phase_completions,
      computed_at: resilience.computed_at,
    },
    behaviorPatternTypes,
    certified,
    renewalHistory,
    avatarAnimationIntegritySlipCount30d: slipAnimCount,
    resiliencePenaltyFromAvatarAnimations,
  };

  const componentScoresJson: Record<string, unknown> = {
    ...report,
    certified: certifiedToJson(certified),
  };

  const card: IntegrityScoreCard = {
    userId,
    computedAt,
    compositeScore,
    overall_integrity_grade: grade,
    grade,
    report,
  };

  return { card, componentScoresJson };
}

/**
 * Loads signals (or reuses from {@link getIntegrityDashboard}), computes weighted grade, upserts `integrity_score_cards`.
 */
export async function getIntegrityScoreCard(
  userId: string,
  options?: {
    now?: Date;
    supabase?: SupabaseClient | null;
    /** When set, skips fetching those inputs (avoids duplicate work inside {@link getIntegrityDashboard}). */
    reuse?: IntegrityScoreCardReuse;
  },
): Promise<IntegrityScoreCard> {
  const now = options?.now ?? new Date();
  const admin = options?.supabase ?? getSupabaseAdmin();
  const reuse = options?.reuse ?? {};

  const [lri, airTrend, resilience, behaviorPatterns, certified, renewalHistory, animationStats30d] =
    await Promise.all([
      reuse.lri !== undefined
        ? Promise.resolve(reuse.lri)
        : getLRI(userId).catch((): null => null),
      reuse.airTrend !== undefined ? Promise.resolve(reuse.airTrend) : getAIRTrend(userId, { now }),
      reuse.resilience !== undefined
        ? Promise.resolve(reuse.resilience)
        : getResilienceScore(userId, { supabase: admin ?? undefined, persist: false }),
      reuse.behaviorPatterns !== undefined
        ? Promise.resolve(reuse.behaviorPatterns)
        : getBehaviorPatterns(userId, { now, supabase: admin ?? undefined, refresh: false }),
      reuse.certified !== undefined ? Promise.resolve(reuse.certified) : getCertifiedStatus(userId),
      reuse.renewalHistory !== undefined
        ? Promise.resolve(reuse.renewalHistory)
        : getRenewalHistory(userId).catch((): RenewalHistory[] => []),
      reuse.animationStats30d !== undefined
        ? Promise.resolve(reuse.animationStats30d)
        : admin != null
          ? getAnimationStats(userId, admin, 30).catch((): null => null)
          : Promise.resolve(null),
    ]);

  const computedAt = now.toISOString();
  const { card, componentScoresJson } = buildPayload(
    userId,
    computedAt,
    airTrend,
    lri,
    resilience,
    behaviorPatterns,
    certified,
    renewalHistory,
    animationStats30d,
  );

  if (admin) {
    try {
      await persistIntegrityScoreCard(admin, userId, card.grade, computedAt, componentScoresJson);
    } catch (e) {
      console.error("[integrity-score-card] persist failed", e);
    }
  }

  return card;
}
