import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Suppression source for Arena router callers — scenario_ids the user has
 * been served within `windowHours`. Single point of update for served-suppression
 * rule changes (status whitelist, window). Behavior preserved from
 * arenaSessionNextCore.ts:103-109 (silent-error swallow → []).
 */
export async function fetchRecentServedScenarioIds(
  supabase: SupabaseClient,
  userId: string,
  windowHours: number = 24,
): Promise<string[]> {
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("arena_runs")
    .select("scenario_id")
    .eq("user_id", userId)
    .in("status", ["DONE", "IN_PROGRESS", "ABANDONED"])
    .gte("started_at", sinceIso);
  return data?.map((x) => x.scenario_id).filter((id): id is string => typeof id === "string") ?? [];
}
