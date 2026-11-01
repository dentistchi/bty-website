import { rewardWritesPaused } from "@/lib/bty/rewardWritePause";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REFLECTION_QUEST_BONUS_XP } from "@/lib/bty/arena/weeklyQuest";

const POLICY = "weekly-reflection-quest/v1";
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min;

export type WeeklyQuestClaim =
  | { outcome: "awarded"; weekStart: string; seasonalXp: number; coreGain: number; coreBefore: number; coreAfter: number; weeklyXpTotal: number }
  | { outcome: "already_claimed" | "not_eligible"; weekStart: string };
type Result = { ok: true; claim: WeeklyQuestClaim } | { ok: false; error: "QUEST_STORAGE_UNAVAILABLE" | "QUEST_AWARD_FAILED" | "REWARD_WRITES_PAUSED" };

/**
 * The claim row, weekly XP and Core commit in one SQL transaction keyed by user and
 * UTC week. A failed call writes nothing, so a later run completion retries safely.
 * Only the service-role writer may invoke it; there is no split-write fallback.
 */
export async function claimWeeklyReflectionQuest(writer: SupabaseClient, input: { userId: string; weekStart: string }): Promise<Result> {
  if (rewardWritesPaused()) return { ok: false, error: "REWARD_WRITES_PAUSED" };
  try {
    const { data, error } = await writer.rpc("bty_claim_weekly_reflection_quest", {
      p_user_id: input.userId, p_week_start: input.weekStart,
    });
    if (error) {
      const code = record(error) ? error.code : undefined;
      return { ok: false, error: code === "PGRST202" || code === "42883" ? "QUEST_STORAGE_UNAVAILABLE" : "QUEST_AWARD_FAILED" };
    }
    if (!record(data) || data.policyVersion !== POLICY || data.weekStart !== input.weekStart) return { ok: false, error: "QUEST_AWARD_FAILED" };
    if (data.outcome === "already_claimed" || data.outcome === "not_eligible") {
      return { ok: true, claim: { outcome: data.outcome, weekStart: input.weekStart } };
    }
    if (data.outcome !== "awarded" || data.seasonalXp !== REFLECTION_QUEST_BONUS_XP
      || !integer(data.coreBefore) || !integer(data.coreAfter) || !integer(data.coreGain)
      || data.coreAfter - data.coreBefore !== data.coreGain || !integer(data.weeklyXpTotal, -2147483648)) {
      return { ok: false, error: "QUEST_AWARD_FAILED" };
    }
    return { ok: true, claim: {
      outcome: "awarded", weekStart: input.weekStart, seasonalXp: data.seasonalXp, coreGain: data.coreGain,
      coreBefore: data.coreBefore, coreAfter: data.coreAfter, weeklyXpTotal: data.weeklyXpTotal,
    } };
  } catch {
    return { ok: false, error: "QUEST_AWARD_FAILED" };
  }
}
