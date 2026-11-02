import type { SupabaseClient } from "@supabase/supabase-js";

export const HEALING_COMPLETION_REVIEW_REQUIRED = "HEALING_COMPLETION_REVIEW_REQUIRED";
export function isHealingCompletionReviewError(error: unknown): boolean {
  return error instanceof Error && error.message === HEALING_COMPLETION_REVIEW_REQUIRED;
}

/** Verify a claimed starter against existing owned evidence. No inference, repair or writes. */
export async function assertStoredStarterConsistency(client: SupabaseClient, userId: string, milestone: {
  second_awakening_completed_at?: string | null; starter_unlock_granted?: string | null;
} | null) {
  if (!milestone) return;
  const starter = milestone.starter_unlock_granted;
  if (!milestone.second_awakening_completed_at) {
    if (starter != null) throw new Error(HEALING_COMPLETION_REVIEW_REQUIRED);
    return;
  }
  if (starter == null) return;
  if (starter !== "PRM" && starter !== "SAG") throw new Error(HEALING_COMPLETION_REVIEW_REQUIRED);
  const { data, error } = await client.from("user_advanced_unlocks").select("advanced_stat_name")
    .eq("user_id", userId).eq("advanced_stat_name", starter).maybeSingle();
  if (error) throw new Error("AWAKENING_PROGRESS_UNAVAILABLE");
  if (data?.advanced_stat_name !== starter) throw new Error(HEALING_COMPLETION_REVIEW_REQUIRED);
}
