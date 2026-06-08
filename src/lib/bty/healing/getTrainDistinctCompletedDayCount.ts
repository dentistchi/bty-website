import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only cross-domain projection: counts a user's DISTINCT completed train
 * days from `train_day_completions`. Consumed by the Second Awakening eligibility
 * gate (결정3 / B2: Awakening = train 완주, distinct day == 28).
 *
 * ⚠️ DISTINCT count, NOT max(day): [1,2,28] => 3 completed days, NOT 28.
 *
 * Pure aggregation — no writes, not a measurement engine (Stage/AIR/TII 무관).
 * RLS: policy `train_day_completions_own` (migration 20260315000001,
 * FOR ALL TO authenticated USING user_id = auth.uid()) lets the caller's own
 * authenticated client read its rows; the explicit user_id filter is kept for
 * clarity and to stay correct under an admin client too.
 */
export async function getTrainDistinctCompletedDayCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("train_day_completions")
    .select("day")
    .eq("user_id", userId);

  if (error || !data) return 0;

  const distinct = new Set(
    data
      .map((r) => Number((r as { day: number }).day))
      .filter((d) => Number.isFinite(d))
  );
  return distinct.size;
}
