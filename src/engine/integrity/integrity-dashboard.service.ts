/**
 * Single-call Leadership Engine dashboard: LRI, AIR trend, promotion readiness, certified, TII, weekly report.
 * In-memory cache 60s per `(userId, teamId)`.
 */

import { getAIRTrend, type AIRTrend } from "@/engine/integrity/air-trend.service";
import { getBehaviorPatterns } from "@/engine/integrity/behavior-pattern.service";
import {
  getRenewalHistory,
  type RenewalHistory,
} from "@/engine/integrity/certification-renewal.service";
import { getCertifiedStatus, type CertifiedLeaderStatus } from "@/engine/integrity/certified-leader.monitor";
import {
  getIntegrityScoreCard,
  type IntegrityScoreCard,
} from "@/engine/integration/integrity-score-card.service";
import { getLRI, type LRIResult } from "@/engine/integrity/lri-calculator.service";
import {
  getPromotionReadiness,
  type PromotionReadiness,
} from "@/engine/integrity/promotion-readiness.service";
import { getTeamTIISnapshot, type TeamTIISnapshotRow } from "@/engine/integrity/tii-calculator.service";
import { mondayUtcWeekOf, getWeeklyReport, type WeeklyAIRReport } from "@/engine/integrity/weekly-air-report.service";
import { getResilienceScore, type ResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const TTL_MS = 60_000;

const cache = new Map<string, { expiresAt: number; payload: IntegrityDashboard }>();

/** Latest Elite Spec nomination row for UI (PENDING blocks new self-nomination CTA). */
export type EliteNominationSnapshot = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  nominatedAt: string;
};

export type IntegrityDashboard = {
  userId: string;
  teamId: string | null;
  computedAt: string;
  lri: LRIResult | null;
  airTrend: AIRTrend;
  promotionReadiness: PromotionReadiness;
  certified: CertifiedLeaderStatus;
  tii: TeamTIISnapshotRow | null;
  weeklyReport: WeeklyAIRReport | null;
  eliteNomination: EliteNominationSnapshot | null;
  /** Certified Leader auto-renewal attempts (expiry cron). */
  renewalHistory: RenewalHistory[];
  integrityScoreCard: IntegrityScoreCard;
};

function cacheKey(userId: string, teamId: string | null | undefined): string {
  return `${userId}::${teamId ?? ""}`;
}

/** Alias for {@link getTeamTIISnapshot} (team TII row). */
export const getTIISnapshot = getTeamTIISnapshot;

export function clearIntegrityDashboardCacheForTests(): void {
  cache.clear();
}

/** Drop cached payload so the next {@link getIntegrityDashboard} hits DB (e.g. after Realtime). */
export function invalidateIntegrityDashboardCache(userId: string, teamId: string | null | undefined): void {
  cache.delete(cacheKey(userId, teamId));
}

async function getLatestEliteNomination(userId: string): Promise<EliteNominationSnapshot | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("elite_spec_nominations")
    .select("status, nominated_at")
    .eq("user_id", userId)
    .order("nominated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { status: string; nominated_at: string };
  const s = row.status;
  if (s !== "PENDING" && s !== "APPROVED" && s !== "REJECTED") return null;
  return { status: s, nominatedAt: row.nominated_at };
}

/**
 * Aggregates integrity signals for one widget/API response; cached 60s per user+team.
 */
export async function getIntegrityDashboard(
  userId: string,
  teamId: string | null | undefined,
): Promise<IntegrityDashboard> {
  const key = cacheKey(userId, teamId);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.payload;
  }

  const at = new Date();
  const weekOf = mondayUtcWeekOf(at);
  const admin = getSupabaseAdmin();

  const [
    lri,
    airTrend,
    promotionReadiness,
    certified,
    tii,
    weeklyReport,
    eliteNomination,
    renewalHistory,
    resilience,
    behaviorPatterns,
  ] = await Promise.all([
    getLRI(userId).catch((): null => null),
    getAIRTrend(userId, { now: at }),
    getPromotionReadiness(userId, { now: at }),
    getCertifiedStatus(userId),
    teamId
      ? getTeamTIISnapshot(teamId).catch((): null => null)
      : Promise.resolve(null as TeamTIISnapshotRow | null),
    getWeeklyReport(userId, weekOf),
    getLatestEliteNomination(userId),
    getRenewalHistory(userId).catch((): [] => []),
    getResilienceScore(userId, { supabase: admin ?? undefined, persist: false }).catch(
      (): null => null,
    ),
    getBehaviorPatterns(userId, { now: at, refresh: false }),
  ]);

  const integrityScoreCard = await getIntegrityScoreCard(userId, {
    now: at,
    reuse: {
      lri,
      airTrend,
      resilience: resilience ?? undefined,
      behaviorPatterns,
      certified,
      renewalHistory,
    },
  });

  const payload: IntegrityDashboard = {
    userId,
    teamId: teamId ?? null,
    computedAt: at.toISOString(),
    lri,
    airTrend,
    promotionReadiness,
    certified,
    tii,
    weeklyReport,
    eliteNomination,
    renewalHistory,
    integrityScoreCard,
  };

  cache.set(key, { expiresAt: now + TTL_MS, payload });
  return payload;
}
