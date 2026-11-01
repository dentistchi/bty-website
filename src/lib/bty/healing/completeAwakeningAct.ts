import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isValidHealingAwakeningActId,
  isHealingAwakeningCompletionHistoryValid,
  nextHealingAwakeningActAfter,
  type AwakeningActId,
} from "@/domain/healing";
import { assertStoredStarterConsistency, isHealingCompletionReviewError } from "./healingCompletionRead.server";
import { completeAtomicAct } from "./healingCompletion.server";

export type CompleteAwakeningActApiResult =
  | { ok: true; completedActs: AwakeningActId[] }
  | { status: 400 | 403 | 409 | 500 | 503; error: string };

/**
 * Record one Healing/Awakening act completion (DB + domain order).
 */
export async function completeHealingAwakeningAct(
  _supabase: SupabaseClient,
  userId: string,
  rawActId: unknown
): Promise<CompleteAwakeningActApiResult> {
  const n = typeof rawActId === "number" ? rawActId : Number(rawActId);
  if (!isValidHealingAwakeningActId(n)) {
    return { status: 400, error: "INVALID_ACT_ID" };
  }
  const actId = n as AwakeningActId;

  const result = await completeAtomicAct(userId, actId);
  if (!result.ok) return { status: result.status, error: result.error };
  return { ok: true, completedActs: result.value.completedActs as AwakeningActId[] };
}

export type HealingAwakeningProgressResult =
  | { ok: true; completedActs: AwakeningActId[]; nextAct: AwakeningActId | null }
  | { status: 409 | 500; error: string };

/** Second Awakening 액트 진행 조회 (GET healing/progress). */
export async function getHealingAwakeningProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<HealingAwakeningProgressResult> {
  const { data: rows, error } = await supabase
    .from("user_healing_awakening_acts")
    .select("act_id")
    .eq("user_id", userId)
    .order("act_id", { ascending: true });

  if (error || !Array.isArray(rows)) return { status: 500, error: "AWAKENING_PROGRESS_UNAVAILABLE" };

  const completed = (rows ?? []).map((r) => (r as { act_id: number }).act_id as AwakeningActId);
  if (!isHealingAwakeningCompletionHistoryValid(completed)) return { status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" };
  if (completed.length === 3) {
    const { data: milestone, error: milestoneError } = await supabase.from("user_healing_milestones")
      .select("second_awakening_completed_at, starter_unlock_granted").eq("user_id", userId).maybeSingle();
    if (milestoneError) return { status: 500, error: "AWAKENING_PROGRESS_UNAVAILABLE" };
    try { await assertStoredStarterConsistency(supabase, userId, milestone); }
    catch (error) {
      return isHealingCompletionReviewError(error)
        ? { status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" }
        : { status: 500, error: "AWAKENING_PROGRESS_UNAVAILABLE" };
    }
    if (!(milestone as { second_awakening_completed_at?: string | null } | null)?.second_awakening_completed_at)
      return { status: 409, error: "HEALING_COMPLETION_REVIEW_REQUIRED" };
  }
  const nextAct = nextHealingAwakeningActAfter(completed);
  return { ok: true, completedActs: completed, nextAct };
}
