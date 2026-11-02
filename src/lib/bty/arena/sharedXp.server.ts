import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { REWARD_WRITES_PAUSED, rewardWritesPaused } from "@/lib/bty/rewardWritePause";

/**
 * Shared XP/Core writes. Each call is one SQL transaction that locks the profile
 * row and computes Core in the database, so concurrent awards are all preserved.
 * The database accepts these writes only from the release's v2 functions; the
 * previous release's direct table writes and old RPC names are refused there.
 */
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min;

export type SharedAward = { weeklyXpTotal: number | null; coreBefore: number; coreAfter: number; coreGain: number };
export type SharedXpFailure = { ok: false; error: string };

function failure(error: unknown): SharedXpFailure {
  if (!record(error)) return { ok: false, error: "XP_AWARD_FAILED" };
  if (error.code === "PGRST202" || error.code === "42883") return { ok: false, error: "XP_STORAGE_UNAVAILABLE" };
  const message = typeof error.message === "string" ? error.message : "XP_AWARD_FAILED";
  return { ok: false, error: message };
}
function award(data: unknown): SharedAward | null {
  if (!record(data) || data.policyVersion !== "shared-xp/v2") return null;
  if (!integer(data.coreBefore) || !integer(data.coreAfter) || !integer(data.coreGain)
    || data.coreAfter - data.coreBefore !== data.coreGain) return null;
  if (data.weeklyXpTotal != null && !integer(data.weeklyXpTotal, -2147483648)) return null;
  return { weeklyXpTotal: (data.weeklyXpTotal as number | null) ?? null, coreBefore: data.coreBefore, coreAfter: data.coreAfter, coreGain: data.coreGain };
}
async function call(fn: string, args: RecordValue): Promise<{ ok: true; data: unknown } | SharedXpFailure> {
  if (rewardWritesPaused()) return { ok: false, error: REWARD_WRITES_PAUSED };
  const writer: SupabaseClient | null = getSupabaseAdmin();
  if (!writer) return { ok: false, error: "XP_WRITER_UNAVAILABLE" };
  try {
    const { data, error } = await writer.rpc(fn, args);
    if (error) return failure(error);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "XP_AWARD_FAILED" };
  }
}

/** Weekly XP plus seasonal and/or direct Core for one user, atomically. */
export async function awardSharedXp(input: {
  userId: string; leagueId?: string | null; weeklyXp?: number; seasonalCoreXp?: number; directCoreXp?: number;
}): Promise<{ ok: true; award: SharedAward } | SharedXpFailure> {
  const result = await call("bty_award_xp_v2", {
    p_user_id: input.userId, p_league_id: input.leagueId ?? null, p_weekly_delta: input.weeklyXp ?? 0,
    p_seasonal_core_xp: input.seasonalCoreXp ?? 0, p_direct_core_xp: input.directCoreXp ?? 0,
  });
  if (!result.ok) return result;
  const parsed = award(result.data);
  return parsed ? { ok: true, award: parsed } : { ok: false, error: "XP_AWARD_FAILED" };
}

/** Profile lifetime/weekly XP and run total XP (the former increment_arena_xp). */
export async function awardRunXp(userId: string, runId: string, xp: number): Promise<{ ok: true } | SharedXpFailure> {
  const result = await call("bty_award_run_xp_v2", { p_user_id: userId, p_run_id: runId, p_xp: xp });
  if (!result.ok) return result;
  return record(result.data) && result.data.policyVersion === "shared-xp/v2" && result.data.xp === xp
    ? { ok: true } : { ok: false, error: "XP_AWARD_FAILED" };
}

/** Activity event, weekly XP and seasonal Core together. */
export async function awardActivityXp(userId: string, activityType: string, xp: number, leagueId: string | null): Promise<{ ok: true; award: SharedAward } | SharedXpFailure> {
  const result = await call("bty_award_activity_xp_v2", { p_user_id: userId, p_activity_type: activityType, p_delta: xp, p_league_id: leagueId });
  if (!result.ok) return result;
  const parsed = award(result.data);
  return parsed && record(result.data) && result.data.xp === xp ? { ok: true, award: parsed } : { ok: false, error: "XP_AWARD_FAILED" };
}

/** LAB ledger row (idempotency key) and direct Core together. */
export async function awardLabXpAtomic(userId: string, amount: number, sourceId: string): Promise<
  { ok: true; outcome: "awarded"; award: SharedAward } | { ok: true; outcome: "already_applied" } | SharedXpFailure> {
  const result = await call("bty_award_lab_xp_v2", { p_user_id: userId, p_amount: amount, p_source_id: sourceId });
  if (!result.ok) return result;
  if (record(result.data) && result.data.policyVersion === "shared-xp/v2" && result.data.outcome === "already_applied") {
    return { ok: true, outcome: "already_applied" };
  }
  const parsed = award(result.data);
  return parsed && record(result.data) && result.data.outcome === "awarded"
    ? { ok: true, outcome: "awarded", award: parsed } : { ok: false, error: "XP_AWARD_FAILED" };
}

/** RUN_COMPLETED_APPLIED anchor, weekly XP, direct Core and ARENA ledger together, once per run. */
export async function applyArenaRunRewardsAtomic(input: {
  userId: string; runId: string; scenarioId: string | null; weeklyXp: number; coreXp: number;
}): Promise<{ ok: true; applied: false } | { ok: true; applied: true; award: SharedAward } | SharedXpFailure> {
  const result = await call("bty_apply_arena_run_rewards_v2", {
    p_user_id: input.userId, p_run_id: input.runId, p_scenario_id: input.scenarioId ?? "unknown",
    p_weekly_delta: input.weeklyXp, p_core_xp: input.coreXp,
  });
  if (!result.ok) return result;
  if (record(result.data) && result.data.policyVersion === "shared-xp/v2" && result.data.applied === false) return { ok: true, applied: false };
  const parsed = award(result.data);
  return parsed && record(result.data) && result.data.applied === true
    ? { ok: true, applied: true, award: parsed } : { ok: false, error: "XP_AWARD_FAILED" };
}
