import type { SupabaseClient } from "@supabase/supabase-js";
import type { AwakeningActId } from "@/domain/healing";

/**
 * Reads user’s recorded Healing/Awakening act completions (DB only).
 */
export async function getUserCompletedAwakeningActs(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true; completedActs: AwakeningActId[] } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("user_healing_awakening_acts")
    .select("act_id")
    .eq("user_id", userId)
    .order("act_id", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const completed = (rows ?? []).map((r) =>
    Number((r as { act_id: number }).act_id)
  ) as AwakeningActId[];

  return { ok: true, completedActs: completed };
}
