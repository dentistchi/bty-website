/**
 * Leadership Readiness — 14d daily AIR from `le_activation_log`, weighted trend LRI,
 * `promotion_ready` when every daily AIR ≥ 0.80 (80 on 0–100).
 *
 * Recent week (last 7 of 14 days, newest half) weighted 1.5× vs older week 1×.
 */

import {
  computeAIR,
  LRI_READINESS_THRESHOLD,
  type ActivationRecord,
  type ActivationType,
} from "@/domain/leadership-engine";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 86_400_000;
const DAYS = 14 as const;
const WEIGHT_OLDER_WEEK = 1 as const;
const WEIGHT_RECENT_WEEK = 1.5 as const;

/** Persisted / API snapshot (not the domain `LRIResult` from `computeLRI`). */
export type LRIResult = {
  lri: number;
  promotion_ready: boolean;
  daily_air_averages: readonly number[];
  calculated_at: string;
};

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Weights aligned with `daily_air_averages`: index 0 = oldest day, 13 = newest. Last 7 days → 1.5×. */
export function dailyTrendWeights14(): readonly number[] {
  const w: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    w.push(i < 7 ? WEIGHT_OLDER_WEEK : WEIGHT_RECENT_WEEK);
  }
  return w;
}

function weightedTrendLri(dailyAir: readonly number[], weights: readonly number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < dailyAir.length; i++) {
    const wi = weights[i] ?? 1;
    num += dailyAir[i] * wi;
    den += wi;
  }
  return den > 0 ? num / den : 0;
}

async function loadActivationRecordsForUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  rangeStart: Date,
  rangeEndExclusive: Date
): Promise<ActivationRecord[]> {
  const { data: logs, error } = await admin
    .from("le_activation_log")
    .select("activation_id, user_id, type, chosen_at, due_at, completed_at")
    .eq("user_id", userId)
    .gte("chosen_at", rangeStart.toISOString())
    .lt("chosen_at", rangeEndExclusive.toISOString());

  if (error) throw error;
  if (!logs?.length) return [];

  const activationIds = logs.map((r: { activation_id: string }) => r.activation_id);
  const { data: verifications } = await admin
    .from("le_verification_log")
    .select("activation_id, verified")
    .in("activation_id", activationIds)
    .order("verified_at", { ascending: false });

  const verifiedSet = new Set<string>();
  const seen = new Set<string>();
  for (const v of verifications ?? []) {
    const id = (v as { activation_id: string; verified: boolean }).activation_id;
    if (!seen.has(id)) {
      seen.add(id);
      if ((v as { verified: boolean }).verified) verifiedSet.add(id);
    }
  }

  return logs.map((r) => ({
    activation_id: (r as { activation_id: string }).activation_id,
    user_id: (r as { user_id: string }).user_id,
    type: (r as { type: string }).type as ActivationType,
    chosen_at: new Date((r as { chosen_at: string }).chosen_at),
    due_at: new Date((r as { due_at: string }).due_at),
    completed_at: (r as { completed_at: string | null }).completed_at
      ? new Date((r as { completed_at: string }).completed_at)
      : null,
    verified: verifiedSet.has((r as { activation_id: string }).activation_id),
  }));
}

/**
 * 14 UTC calendar days ending at `now`: oldest → newest daily AIR using `computeAIR` on that day’s activations only.
 */
export async function computeDailyAir14(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  now: Date
): Promise<number[]> {
  const todayStart = utcDayStart(now);
  const firstDay = new Date(todayStart.getTime() - (DAYS - 1) * MS_PER_DAY);
  const endExclusive = new Date(todayStart.getTime() + MS_PER_DAY);
  const allRecords = await loadActivationRecordsForUser(admin, userId, firstDay, endExclusive);

  const byDay = new Map<string, ActivationRecord[]>();
  for (const r of allRecords) {
    const key = r.chosen_at.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }

  const dailyAirs: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    const dayStart = new Date(firstDay.getTime() + i * MS_PER_DAY);
    const key = dayStart.toISOString().slice(0, 10);
    const recs = byDay.get(key) ?? [];
    const dayEndAsOf = new Date(dayStart.getTime() + MS_PER_DAY - 1);
    const { air } = computeAIR(recs, "7d", dayEndAsOf);
    dailyAirs.push(air);
  }

  return dailyAirs;
}

export function evaluatePromotionReady(dailyAir: readonly number[]): boolean {
  return (
    dailyAir.length === DAYS &&
    dailyAir.every((a) => a >= LRI_READINESS_THRESHOLD)
  );
}

/**
 * Recompute weighted LRI, insert `leadership_readiness_index`, return snapshot.
 */
export async function recomputeAndPersistLRI(userId: string): Promise<LRIResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("recomputeAndPersistLRI: Supabase service role not configured");
  }

  const now = new Date();
  const daily_air_averages = await computeDailyAir14(admin, userId, now);
  const weights = dailyTrendWeights14();
  const lri = weightedTrendLri(daily_air_averages, weights);
  const promotion_ready = evaluatePromotionReady(daily_air_averages);
  const calculated_at = now.toISOString();

  const { error } = await admin.from("leadership_readiness_index").insert({
    user_id: userId,
    lri,
    promotion_ready,
    daily_air: daily_air_averages,
    calculated_at,
  });
  if (error) throw error;

  try {
    const { onLRIWrite } = await import("@/engine/integrity/certified-leader.monitor");
    await onLRIWrite(userId);
  } catch (e) {
    console.error("[recomputeAndPersistLRI] certified leader monitor:", e);
  }

  return { lri, promotion_ready, daily_air_averages, calculated_at };
}

/**
 * Latest persisted readiness row for the user.
 */
async function fetchLatestLRI(userId: string): Promise<LRIResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("getLRI: Supabase service role not configured");
  }

  const { data, error } = await admin
    .from("leadership_readiness_index")
    .select("lri, promotion_ready, daily_air, calculated_at")
    .eq("user_id", userId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`getLRI: no leadership_readiness_index row for user ${userId}`);
  }

  const daily = data.daily_air as unknown;
  const daily_air_averages = Array.isArray(daily)
    ? (daily as number[]).map((n) => Number(n))
    : [];

  return {
    lri: Number(data.lri),
    promotion_ready: Boolean(data.promotion_ready),
    daily_air_averages,
    calculated_at:
      typeof data.calculated_at === "string"
        ? data.calculated_at
        : new Date(data.calculated_at as string).toISOString(),
  };
}

export async function getLRI(userId: string): Promise<LRIResult> {
  return fetchLatestLRI(userId);
}

export class LRICalculatorService {
  recomputeAndPersist(userId: string): Promise<LRIResult> {
    return recomputeAndPersistLRI(userId);
  }

  getLRI(userId: string): Promise<LRIResult> {
    return fetchLatestLRI(userId);
  }
}
