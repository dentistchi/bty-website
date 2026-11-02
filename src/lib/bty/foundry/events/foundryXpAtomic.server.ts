import { rewardWritesPaused } from "@/lib/bty/rewardWritePause";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidIanaTz } from "@/lib/bty/daily/userDay";
import { syncAvatarStateAfterCoreXpChange } from "@/engine/avatar/avatar-state.service";

export type FoundryXpStatus = "awarded" | "claimable" | "owner_ineligible" | "daily_limit" | "none" | "unavailable" | "review_required";
export type FoundryAwardOutcome = "awarded" | "already_awarded" | "event_already_awarded" | "owner_ineligible" | "daily_limit" | "unavailable" | "review_required";
export type FoundryAwardReceipt = {
  policyVersion: "foundry-core-atomic/v1";
  outcome: "awarded" | "already_awarded" | "event_already_awarded";
  userId: string; eventId: string; requestedProgressId: string; awardedProgressId: string;
  receiptId: string; ledgerId: number; deltaXp: 10; coreBefore: number; coreAfter: number; replayed: boolean;
};
export type FoundryAwardAcknowledgement = FoundryAwardReceipt | {
  policyVersion: "foundry-core-atomic/v1"; outcome: "owner_ineligible" | "daily_limit" | "review_required";
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const integer = (v: unknown, minimum = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= minimum && v <= 2147483647;
export function parseFoundryAwardAcknowledgement(value: unknown, expected: { userId: string; eventId: string; progressId: string }): FoundryAwardAcknowledgement | null {
  if (!object(value) || value.policyVersion !== "foundry-core-atomic/v1") return null;
  if (["owner_ineligible", "daily_limit", "review_required"].includes(String(value.outcome))) return value as FoundryAwardAcknowledgement;
  if (!["awarded", "already_awarded", "event_already_awarded"].includes(String(value.outcome))
    || value.userId !== expected.userId || value.eventId !== expected.eventId || value.requestedProgressId !== expected.progressId
    || !uuid(value.awardedProgressId)
    || !uuid(value.receiptId) || typeof value.ledgerId !== "number" || !Number.isSafeInteger(value.ledgerId) || value.ledgerId < 1
    || value.deltaXp !== 10 || !integer(value.coreBefore) || !integer(value.coreAfter) || value.coreAfter - value.coreBefore !== 10
    || typeof value.replayed !== "boolean") return null;
  if (value.outcome === "awarded" && (value.replayed || value.awardedProgressId !== expected.progressId)) return null;
  if (value.outcome === "already_awarded" && (!value.replayed || value.awardedProgressId !== expected.progressId)) return null;
  if (value.outcome === "event_already_awarded" && (!value.replayed || value.awardedProgressId === expected.progressId)) return null;
  return value as FoundryAwardReceipt;
}
export function foundryOutcomeToXpStatus(outcome: FoundryAwardOutcome): FoundryXpStatus {
  return outcome === "awarded" || outcome === "already_awarded" || outcome === "event_already_awarded" ? "awarded" : outcome;
}
export function syncFoundryAvatarAfterAward(admin: SupabaseClient, receipt: FoundryAwardAcknowledgement, outerReplay = false): void {
  if (receipt.outcome !== "awarded" || receipt.replayed || outerReplay) return;
  try { void syncAvatarStateAfterCoreXpChange(receipt.userId, admin, receipt.coreBefore, receipt.coreAfter).catch(() => {}); }
  catch { /* A derived avatar refresh must not turn a committed reward into failure. */ }
}
export async function awardFoundryCoreAtomic(admin: SupabaseClient, input: {
  userId: string; eventId: string; progressId: string; start: string; end: string;
}): Promise<FoundryAwardOutcome> {
  if (rewardWritesPaused()) return "unavailable";
  try {
    const { data, error } = await admin.rpc("bty_foundry_award_core_atomic", {
      p_user_id: input.userId, p_event_id: input.eventId, p_progress_id: input.progressId,
      p_day_start: input.start, p_day_end: input.end,
    });
    if (error) return error.message === "FOUNDRY_XP_REVIEW_REQUIRED" ? "review_required" : "unavailable";
    const receipt = parseFoundryAwardAcknowledgement(data, input);
    if (!receipt) return "unavailable";
    syncFoundryAvatarAfterAward(admin, receipt);
    return receipt.outcome;
  } catch { return "unavailable"; }
}

/** Reward cap preparation is read-only and cannot turn a failed lookup into UTC. */
export async function readFoundryRewardTimezone(admin: SupabaseClient, userId: string, deviceTz?: string | null): Promise<string> {
  const { data, error } = await admin.from("arena_profiles").select("timezone").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("FOUNDRY_XP_TIMEZONE_UNAVAILABLE");
  if (isValidIanaTz(data?.timezone)) return data.timezone;
  return isValidIanaTz(deviceTz) ? deviceTz : "UTC";
}

/** Timestamp-only historical evidence cannot establish a successful Core write. */
export async function readConfirmedFoundryXpStatus(admin: SupabaseClient, progress: {
  id: string; event_id: string; linked_user_id: string | null; xp_awarded_at: string | null; completed_at: string | null;
} | null, ownerUserId?: string | null): Promise<FoundryXpStatus> {
  if (!progress?.completed_at) return "none";
  if (!progress.linked_user_id) return progress.xp_awarded_at ? "review_required" : "claimable";
  try {
    // One account/event reward may originate from another participant session.
    // The requested progress stays unmodified; the original receipt proves payment.
    const { data, error } = await admin.from("foundry_xp_reward_receipts").select("result")
      .eq("user_id", progress.linked_user_id).eq("event_id", progress.event_id).maybeSingle();
    if (error) return "unavailable";
    if (!data) return progress.linked_user_id === ownerUserId ? "owner_ineligible" : progress.xp_awarded_at ? "review_required" : "claimable";
    const original = data.result;
    if (!object(original) || !uuid(original.awardedProgressId)) return "unavailable";
    const receipt = parseFoundryAwardAcknowledgement(original, { userId: progress.linked_user_id,
      eventId: progress.event_id, progressId: original.awardedProgressId });
    return receipt?.outcome === "awarded" ? "awarded" : "unavailable";
  } catch { return "unavailable"; }
}
