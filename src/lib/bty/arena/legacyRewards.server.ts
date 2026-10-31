import type { SupabaseClient } from "@supabase/supabase-js";
import type { BeginnerRunResponses, MaturityFeedback } from "@/lib/bty/scenario/beginnerTypes";

const POLICY = "legacy-xp-atomic/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = 2147483647): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const fraction = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1;

type CommonReceipt = { policyVersion: string; runId: string; scenarioId: string; receiptId: string; eventId: string; replayed: boolean };
export type ChoiceRewardReceipt = CommonReceipt & { kind: "legacy_choice"; choiceId: string; step: number; xp: number };
export type BeginnerRewardReceipt = CommonReceipt & {
  kind: "beginner_completion"; score: number; feedback: MaturityFeedback; seasonalXp: number;
  coreGain: number; coreBefore: number; coreAfter: number; coreBufferBefore: number; coreBufferAfter: number; weeklyXpTotal: number;
};
type Result<T> = { ok: true; receipt: T } | { ok: false; status: number; error: string };
const failed = (): { ok: false; status: number; error: string } => ({ ok: false, status: 500, error: "XP_AWARD_FAILED" });
function rpcError(error: unknown): ReturnType<typeof failed> {
  if (!record(error)) return failed();
  if (error.code === "PGRST202" || error.code === "42883") return { ok: false, status: 503, error: "XP_STORAGE_UNAVAILABLE" };
  const statuses: Record<string, number> = {
    REWARD_RUN_NOT_FOUND: 404, RUN_SCENARIO_MISMATCH: 409, RUN_NOT_ACTIVE: 409,
    NOT_BEGINNER_RUN: 400, LEGACY_REWARD_REVIEW_REQUIRED: 409,
    REWARD_INPUT_CONFLICT: 409, INVALID_REWARD_INPUT: 400,
  };
  const message = typeof error.message === "string" ? error.message : "";
  return Object.prototype.hasOwnProperty.call(statuses, message)
    ? { ok: false, status: statuses[message], error: message } : failed();
}
function common(value: unknown, runId: string, scenarioId: string): value is RecordValue & CommonReceipt {
  return record(value) && value.policyVersion === POLICY && uuid(value.runId) && value.runId.toLowerCase() === runId.toLowerCase()
    && value.scenarioId === scenarioId && uuid(value.receiptId) && uuid(value.eventId) && typeof value.replayed === "boolean";
}
function feedback(value: unknown): value is MaturityFeedback {
  return record(value) && ["reactive", "aware", "intentional"].includes(String(value.band))
    && text(value.label, 500) && text(value.message, 10000);
}

/** Only the service-role writer may invoke the atomic SQL boundary. No split-write fallback. */
export async function recordLegacyChoiceReward(writer: SupabaseClient, input: {
  userId: string; runId: string; scenarioId: string; choiceId: string; step: number; xp: number;
  deltas: unknown; meta: unknown;
}): Promise<Result<ChoiceRewardReceipt>> {
  try {
    const { data, error } = await writer.rpc("bty_record_legacy_choice_reward", {
      p_user_id: input.userId, p_run_id: input.runId, p_scenario_id: input.scenarioId,
      p_choice_id: input.choiceId, p_step: input.step, p_xp: input.xp, p_deltas: input.deltas, p_meta: input.meta,
    });
    if (error) return rpcError(error);
    if (!common(data, input.runId, input.scenarioId) || data.kind !== "legacy_choice"
      || data.choiceId !== input.choiceId || data.step !== input.step || !integer(data.xp, 0, 10000)
      || (!data.replayed && data.xp !== input.xp)) return failed();
    return { ok: true, receipt: data as ChoiceRewardReceipt };
  } catch { return failed(); }
}

export async function completeBeginnerReward(writer: SupabaseClient, input: {
  userId: string; runId: string; scenarioId: string; responses: BeginnerRunResponses; score: number; feedback: MaturityFeedback;
}): Promise<Result<BeginnerRewardReceipt>> {
  try {
    const { data, error } = await writer.rpc("bty_complete_beginner_reward", {
      p_user_id: input.userId, p_run_id: input.runId, p_scenario_id: input.scenarioId,
      p_responses: input.responses, p_score: input.score, p_feedback: input.feedback,
    });
    if (error) return rpcError(error);
    if (!common(data, input.runId, input.scenarioId) || data.kind !== "beginner_completion"
      || !integer(data.score, 0, 20) || !feedback(data.feedback) || data.seasonalXp !== 30
      || !integer(data.coreBefore) || !integer(data.coreAfter) || !integer(data.coreGain)
      || data.coreAfter - data.coreBefore !== data.coreGain
      || typeof data.coreBufferBefore !== "number" || !Number.isFinite(data.coreBufferBefore) || data.coreBufferBefore < 0
      || !fraction(data.coreBufferAfter)
      || !integer(data.weeklyXpTotal, -2147483648)
      || (!data.replayed && (data.score !== input.score || data.feedback.band !== input.feedback.band
        || data.feedback.label !== input.feedback.label || data.feedback.message !== input.feedback.message))) return failed();
    return { ok: true, receipt: data as BeginnerRewardReceipt };
  } catch { return failed(); }
}
