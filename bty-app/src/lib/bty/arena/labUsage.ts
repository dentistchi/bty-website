/**
 * Leadership Lab daily attempt limit per docs/spec/ARENA_LAB_XP_SPEC.md.
 * Consumed on submit success only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** UTC date string YYYY-MM-DD for today. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get number of Lab attempts already used today. */
export async function getLabAttemptsUsed(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const usageDate = todayUtc();
  const { data, error } = await supabase
    .from("daily_lab_usage")
    .select("attempts_used")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) return 0;
  const used = (data as { attempts_used?: number } | null)?.attempts_used;
  return typeof used === "number" && used >= 0 ? used : 0;
}

/**
 * Consume one Lab attempt for today (atomic via RPC). Call only after a successful Lab submit.
 * Returns { consumed: true, attemptsUsed } or { error }.
 */
export async function consumeLabAttempt(
  supabase: SupabaseClient,
  userId: string
): Promise<{ consumed: true; attemptsUsed: number } | { error: string }> {
  const { data, error } = await supabase.rpc("consume_lab_attempt", {
    p_user_id: userId,
  });

  if (error) return { error: error.message };
  const used = typeof data === "number" ? data : -1;
  if (used < 0) return { error: "LAB_DAILY_LIMIT_REACHED" };
  return { consumed: true, attemptsUsed: used };
}
