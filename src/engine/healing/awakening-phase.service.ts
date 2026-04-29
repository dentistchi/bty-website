/**
 * RENEWAL-stage awakening milestones — evaluated from Arena stats, AIR trend, Center diagnostics, mentor activity.
 * Persisted on first entry to {@link HealingPhase} `RENEWAL` and refreshed from {@link getAwakeningProgress}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAIRTrend } from "@/engine/integrity/air-trend.service";
import { getScenarioStats } from "@/engine/scenario/scenario-stats.service";
import { getPhaseGateStatus } from "@/engine/healing/healing-content.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function resolveAwakeningClient(supabase?: SupabaseClient): SupabaseClient {
  const c = supabase ?? getSupabaseAdmin();
  if (!c) {
    throw new Error(
      "[awakening-phase] Pass supabase (e.g. getSupabaseServerClient from a route handler) or set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return c;
}

export type AwakeningConditionType =
  | "streak"
  | "air_threshold"
  | "scenario_count"
  | "mentor_session";

export type AwakeningMilestoneDef = {
  id: string;
  titleKo: string;
  titleEn: string;
  conditionType: AwakeningConditionType;
  /** Meaning depends on `conditionType` (see {@link milestoneSatisfied}). */
  conditionValue: number;
};

/**
 * Four RENEWAL awakening milestones (order = display / “next” order).
 * - `air_threshold`: `conditionValue` is percent 0–100 vs 7-day mean AIR (0–1 scale × 100).
 */
/** Human-readable condition line for milestone cards (KO / EN). */
export function describeMilestoneCondition(
  m: AwakeningMilestoneDef,
  loc: "ko" | "en",
): string {
  const v = m.conditionValue;
  switch (m.conditionType) {
    case "streak":
      return loc === "ko"
        ? `Arena 연속 플레이 ${v}일 이상 (UTC 기준)`
        : `At least ${v} consecutive UTC days with at least one Arena completion`;
    case "air_threshold":
      return loc === "ko"
        ? `최근 7일 실행 무결성(AIR) 평균 ${v}% 이상 (내부 목표치; 밴드와 별도)`
        : `7-day mean execution integrity (AIR) at least ${v}% on the 0–100 scale (internal target; separate from bands)`;
    case "scenario_count":
      return loc === "ko"
        ? `서로 다른 시나리오 ${v}개 이상 완료`
        : `Complete at least ${v} distinct scenarios`;
    case "mentor_session":
      return loc === "ko"
        ? `RENEWAL 단계 진단 게이트 완료 + Dr. Chi 멘토 메시지 ${v}회 이상`
        : `RENEWAL phase diagnostics complete + at least ${v} Dr. Chi mentor message(s)`;
    default:
      return "";
  }
}

/** Milestone that requires Center RENEWAL gate + Dr. Chi mentor messages. */
export const AWAKENING_MENTOR_MILESTONE_ID = "awakening_renewal_center_and_mentor" as const;

export const AWAKENING_MILESTONES: readonly AwakeningMilestoneDef[] = [
  {
    id: "awakening_renewal_streak",
    titleKo: "연속 실천 주간",
    titleEn: "Sustain a daily Arena streak",
    conditionType: "streak",
    conditionValue: 3,
  },
  {
    id: "awakening_renewal_air",
    titleKo: "AIR 7일 평균 목표",
    titleEn: "Reach target 7-day AIR average",
    conditionType: "air_threshold",
    conditionValue: 72,
  },
  {
    id: "awakening_renewal_scenarios",
    titleKo: "시나리오 탐색 폭",
    titleEn: "Diversify Arena scenario completions",
    conditionType: "scenario_count",
    conditionValue: 8,
  },
  {
    id: AWAKENING_MENTOR_MILESTONE_ID,
    titleKo: "센터 진단·멘토 세션",
    titleEn: "Center RENEWAL gate + mentor touchpoints",
    conditionType: "mentor_session",
    conditionValue: 1,
  },
] as const;

export type AwakeningProgress = {
  completed: number;
  total: number;
  completedIds: string[];
  /** First not-yet-satisfied milestone in {@link AWAKENING_MILESTONES} order; `null` if all done. */
  nextHint: {
    milestoneId: string;
    titleKo: string;
    titleEn: string;
  } | null;
};

export type MilestoneEvaluationContext = {
  stats: Awaited<ReturnType<typeof getScenarioStats>>;
  air: Awaited<ReturnType<typeof getAIRTrend>>;
  renewalGatePct: number;
  mentorMessageCount: number;
};

async function countMentorMessages(
  userId: string,
  supabase?: SupabaseClient,
): Promise<number> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return 0;
  const { count, error } = await client
    .from("activity_xp_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("activity_type", "MENTOR_MESSAGE");
  if (error) {
    console.warn("[countMentorMessages]", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Evaluates a single milestone using aggregated signals (stats, AIR, Center RENEWAL gate, mentor counts).
 */
export function milestoneSatisfied(
  m: AwakeningMilestoneDef,
  ctx: MilestoneEvaluationContext,
): boolean {
  const v = m.conditionValue;
  switch (m.conditionType) {
    case "streak":
      return ctx.stats.streakDaysUtc >= v;
    case "air_threshold": {
      const minAir = v / 100;
      return (
        Number.isFinite(ctx.air.last7DayWindowAvg) && ctx.air.last7DayWindowAvg >= minAir
      );
    }
    case "scenario_count":
      return ctx.stats.uniqueScenariosPlayed >= v;
    case "mentor_session": {
      const renewalOk = ctx.renewalGatePct >= 1;
      const mentorOk = ctx.mentorMessageCount >= v;
      return renewalOk && mentorOk;
    }
    default:
      return false;
  }
}

async function loadEvaluationContext(
  userId: string,
  supabase?: SupabaseClient,
): Promise<MilestoneEvaluationContext> {
  const [stats, air, mentorMessageCount] = await Promise.all([
    getScenarioStats(userId, "en"),
    getAIRTrend(userId, { emitWarning: false }),
    countMentorMessages(userId, supabase),
  ]);
  let renewalGatePct = 0;
  try {
    const gate = await getPhaseGateStatus(userId, "RENEWAL", supabase);
    renewalGatePct = gate.completion_pct;
  } catch (e) {
    console.warn("[loadEvaluationContext] renewal gate", e);
  }
  return {
    stats,
    air,
    renewalGatePct,
    mentorMessageCount,
  };
}

function satisfiedIds(
  ctx: MilestoneEvaluationContext,
): Set<string> {
  const out = new Set<string>();
  for (const m of AWAKENING_MILESTONES) {
    if (milestoneSatisfied(m, ctx)) out.add(m.id);
  }
  return out;
}

async function fetchStoredMilestoneIds(
  userId: string,
  supabase?: SupabaseClient,
): Promise<Set<string>> {
  const client = resolveAwakeningClient(supabase);
  const { data, error } = await client
    .from("user_awakening_milestones")
    .select("milestone_id")
    .eq("user_id", userId);
  if (error) {
    console.warn("[fetchStoredMilestoneIds]", error.message);
    return new Set();
  }
  return new Set(
    (data ?? []).map((r) => (r as { milestone_id: string }).milestone_id),
  );
}

/**
 * Inserts rows for milestones that are satisfied by current metrics but not yet stored.
 */
export async function persistNewlyCompletedMilestones(
  userId: string,
  supabase?: SupabaseClient,
  preloaded?: MilestoneEvaluationContext,
): Promise<void> {
  const client = resolveAwakeningClient(supabase);
  const ctx = preloaded ?? (await loadEvaluationContext(userId, client));
  const live = satisfiedIds(ctx);
  const stored = await fetchStoredMilestoneIds(userId, client);
  const now = new Date().toISOString();
  const rows = [...live].filter((id) => !stored.has(id)).map((milestone_id) => ({
    user_id: userId,
    milestone_id,
    completed_at: now,
  }));
  if (rows.length === 0) return;
  const { error } = await client.from("user_awakening_milestones").insert(rows);
  if (error) console.warn("[persistNewlyCompletedMilestones]", error.message);
}

/**
 * Called when {@link advancePhase} lands on `RENEWAL` — evaluates and persists eligible milestones.
 */
export async function onAdvancedToRenewalPhase(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  await persistNewlyCompletedMilestones(userId, supabase);
}

/**
 * Completed/total, merged stored + live satisfaction; refreshes DB with any newly completed rows.
 */
export async function getAwakeningProgress(
  userId: string,
  supabase?: SupabaseClient,
): Promise<AwakeningProgress> {
  const client = resolveAwakeningClient(supabase);
  const ctx = await loadEvaluationContext(userId, client);
  await persistNewlyCompletedMilestones(userId, client, ctx);

  const live = satisfiedIds(ctx);
  const stored = await fetchStoredMilestoneIds(userId, client);
  const completedIds = AWAKENING_MILESTONES.map((m) => m.id).filter(
    (id) => live.has(id) || stored.has(id),
  );
  const total = AWAKENING_MILESTONES.length;
  const completed = completedIds.length;

  let nextHint: AwakeningProgress["nextHint"] = null;
  for (const m of AWAKENING_MILESTONES) {
    if (!live.has(m.id)) {
      nextHint = {
        milestoneId: m.id,
        titleKo: m.titleKo,
        titleEn: m.titleEn,
      };
      break;
    }
  }

  return {
    completed,
    total,
    completedIds,
    nextHint,
  };
}
