/**
 * 30-day AIR trend from `le_activation_log`: daily AIR, 7-day rolling mean, recent vs prior week direction,
 * and `air_trend_warning` when the rolling series declines 3+ consecutive day-over-day steps.
 *
 * Consumed by Leadership Engine UI and LRI-related analytics (wire explicitly).
 */

import {
  computeAIR,
  airToBand,
  type ActivationRecord,
  type ActivationType,
  type AIRBand,
} from "@/domain/leadership-engine";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MS_PER_DAY = 86_400_000;
const CALENDAR_DAYS = 30 as const;
const ROLLING = 7 as const;

/** |recent − prior| below this (0–1 AIR scale) counts as {@link AIRTrendDirection} `stable`. */
export const AIR_TREND_STABLE_EPS = 0.02 as const;

export type AIRTrendDirection = "improving" | "stable" | "declining";

export type AIRTrend = {
  computedAt: string;
  /** Oldest → newest UTC calendar day within the 30-day window (one AIR per day). */
  dailyAir: readonly number[];
  /** Index `i` = mean of `dailyAir[i-6..i]` when `i >= 6`; otherwise same length with `NaN` for `i < 6`. */
  rolling7DayAverage: readonly number[];
  /** Mean of the last 7 calendar days in the window (indices 23–29). */
  last7DayWindowAvg: number;
  /** {@link airToBand} for {@link last7DayWindowAvg} — UI should prefer this over raw averages. */
  last7DayWindowBand: AIRBand;
  /** Mean of the 7 days before that (indices 16–22). */
  prior7DayWindowAvg: number;
  direction: AIRTrendDirection;
  /** Day-over-day declines in `rolling7DayAverage` counting backward from the last index (stops at first non-decline). */
  consecutiveDecliningRollingSteps: number;
  /** True if `consecutiveDecliningRollingSteps >= 3` and listeners were invoked this call. */
  warningEmitted: boolean;
};

export type AIRTrendWarningPayload = {
  event: "air_trend_warning";
  userId: string;
  consecutiveDecliningRollingSteps: number;
  lastRolling7DayAverage: number;
  priorRolling7DayAverage: number;
  last7DayWindowAvg: number;
  prior7DayWindowAvg: number;
};

const warningListeners = new Set<(payload: AIRTrendWarningPayload) => void>();

export function onAIRTrendWarning(
  listener: (payload: AIRTrendWarningPayload) => void,
): () => void {
  warningListeners.add(listener);
  return () => warningListeners.delete(listener);
}

function emitWarning(payload: AIRTrendWarningPayload): void {
  for (const fn of warningListeners) {
    try {
      fn(payload);
    } catch {
      // listeners must not break trend computation
    }
  }
}

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function loadActivationRecordsForUser(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  rangeStart: Date,
  rangeEndExclusive: Date,
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
    const id = (v as { activation_id: string }).activation_id;
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

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** Build rolling-7 means; indices 0..5 are NaN (insufficient left history). */
export function rolling7DaySeries(daily: readonly number[]): number[] {
  const out: number[] = new Array(daily.length).fill(Number.NaN);
  for (let i = ROLLING - 1; i < daily.length; i++) {
    const slice = daily.slice(i - (ROLLING - 1), i + 1);
    out[i] = mean(slice);
  }
  return out;
}

export function directionFromWindows(
  last7: number,
  prior7: number,
  eps: number = AIR_TREND_STABLE_EPS,
): AIRTrendDirection {
  if (last7 > prior7 + eps) return "improving";
  if (last7 < prior7 - eps) return "declining";
  return "stable";
}

/**
 * Count consecutive day-over-day drops in the rolling series, walking backward from the last index.
 */
export function countConsecutiveDecliningRollingSteps(rolling: readonly number[]): number {
  let steps = 0;
  for (let i = rolling.length - 1; i >= ROLLING; i--) {
    const cur = rolling[i];
    const prev = rolling[i - 1];
    if (typeof cur !== "number" || typeof prev !== "number" || Number.isNaN(cur) || Number.isNaN(prev)) {
      break;
    }
    if (cur < prev - 1e-9) steps += 1;
    else break;
  }
  return steps;
}

function emptyTrend(now: Date): AIRTrend {
  const iso = now.toISOString();
  const daily = Array.from({ length: CALENDAR_DAYS }, () => 0);
  const rolling = rolling7DaySeries(daily);
  return {
    computedAt: iso,
    dailyAir: daily,
    rolling7DayAverage: rolling,
    last7DayWindowAvg: 0,
    last7DayWindowBand: airToBand(0),
    prior7DayWindowAvg: 0,
    direction: "stable",
    consecutiveDecliningRollingSteps: 0,
    warningEmitted: false,
  };
}

/**
 * 30-day activation window, daily AIR, 7-day rolling averages, last vs prior week trend, optional warning.
 */
export async function getAIRTrend(
  userId: string,
  options?: { now?: Date; /** When `false`, do not invoke {@link emitWarning} (e.g. post-session routing reads trend without re-broadcasting). Default `true`. */ emitWarning?: boolean },
): Promise<AIRTrend> {
  const now = options?.now ?? new Date();
  const admin = getSupabaseAdmin();
  if (!admin) {
    return emptyTrend(now);
  }

  const todayStart = utcDayStart(now);
  const firstDay = new Date(todayStart.getTime() - (CALENDAR_DAYS - 1) * MS_PER_DAY);
  const endExclusive = new Date(todayStart.getTime() + MS_PER_DAY);

  let allRecords: ActivationRecord[];
  try {
    allRecords = await loadActivationRecordsForUser(admin, userId, firstDay, endExclusive);
  } catch {
    return emptyTrend(now);
  }

  const byDay = new Map<string, ActivationRecord[]>();
  for (const r of allRecords) {
    const key = r.chosen_at.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }

  const dailyAir: number[] = [];
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const dayStart = new Date(firstDay.getTime() + i * MS_PER_DAY);
    const key = dayStart.toISOString().slice(0, 10);
    const recs = byDay.get(key) ?? [];
    const dayEndAsOf = new Date(dayStart.getTime() + MS_PER_DAY - 1);
    const { air } = computeAIR(recs, "7d", dayEndAsOf);
    dailyAir.push(air);
  }

  const rolling7DayAverage = rolling7DaySeries(dailyAir);

  const last7DayWindowAvg = mean(dailyAir.slice(23, 30));
  const prior7DayWindowAvg = mean(dailyAir.slice(16, 23));

  const direction = directionFromWindows(last7DayWindowAvg, prior7DayWindowAvg);

  const consecutiveDecliningRollingSteps = countConsecutiveDecliningRollingSteps(rolling7DayAverage);

  const shouldEmit = options?.emitWarning !== false;

  let warningEmitted = false;
  if (consecutiveDecliningRollingSteps >= 3) {
    const lastIdx = rolling7DayAverage.length - 1;
    const lr = rolling7DayAverage[lastIdx]!;
    const pr = rolling7DayAverage[lastIdx - 1]!;
    if (shouldEmit) {
      emitWarning({
        event: "air_trend_warning",
        userId,
        consecutiveDecliningRollingSteps,
        lastRolling7DayAverage: lr,
        priorRolling7DayAverage: pr,
        last7DayWindowAvg,
        prior7DayWindowAvg,
      });
    }
    warningEmitted = true;
  }

  return {
    computedAt: now.toISOString(),
    dailyAir,
    rolling7DayAverage,
    last7DayWindowAvg,
    last7DayWindowBand: airToBand(last7DayWindowAvg),
    prior7DayWindowAvg,
    direction,
    consecutiveDecliningRollingSteps,
    warningEmitted,
  };
}
