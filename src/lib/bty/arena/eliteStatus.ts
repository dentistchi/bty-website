import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Top 5% Elite: used for perks (e.g. mentor suggestion from global chat).
 * Uses weekly_xp (league_id null) ordered by xp_total desc; rank <= ceil(count * 0.05) => elite.
 */
export async function getIsEliteTop5(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from("weekly_xp")
    .select("user_id, xp_total")
    .is("league_id", null)
    .order("xp_total", { ascending: false })
    .limit(500);

  if (error || !rows?.length) return false;

  const myIndex = rows.findIndex((r: { user_id: string }) => r.user_id === userId);
  if (myIndex === -1) return false;

  const myRank = myIndex + 1;
  const count = rows.length;
  const topN = Math.max(1, Math.ceil(count * 0.05));
  return myRank <= topN;
}
