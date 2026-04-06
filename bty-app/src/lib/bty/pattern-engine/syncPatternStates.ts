import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_PATTERN_FAMILIES } from "@/domain/pattern-family";

const WINDOW_SIZE = 7;

/**
 * Recomputes `window_run_ids` and `family_window_tally` for each canonical family (ENGINE §5 rules 2–3).
 * Tally = count of **distinct** runs in the window that have at least one **exit** signal for that family (threshold path).
 */
export async function syncPatternStatesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: runs, error: runErr } = await supabase
    .from("arena_runs")
    .select("run_id")
    .eq("user_id", userId)
    .not("reached_step_2_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(WINDOW_SIZE);

  if (runErr) return { ok: false, error: runErr.message };

  const windowRunIds = (runs ?? [])
    .map((r) => (r as { run_id?: string }).run_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (windowRunIds.length === 0) {
    for (const pattern_family of CANONICAL_PATTERN_FAMILIES) {
      const { error } = await supabase.from("pattern_states").upsert(
        {
          user_id: userId,
          pattern_family,
          window_run_ids: [],
          family_window_tally: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pattern_family" },
      );
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { data: exits, error: sigErr } = await supabase
    .from("pattern_signals")
    .select("run_id, pattern_family")
    .eq("user_id", userId)
    .eq("direction", "exit")
    .in("run_id", windowRunIds);

  if (sigErr) return { ok: false, error: sigErr.message };

  const windowSet = new Set(windowRunIds);
  const exitRunsByFamily = new Map<string, Set<string>>();
  for (const row of exits ?? []) {
    const runId = (row as { run_id?: string }).run_id;
    const fam = (row as { pattern_family?: string }).pattern_family;
    if (typeof runId !== "string" || typeof fam !== "string") continue;
    if (!windowSet.has(runId)) continue;
    if (!exitRunsByFamily.has(fam)) exitRunsByFamily.set(fam, new Set());
    exitRunsByFamily.get(fam)!.add(runId);
  }

  const nowIso = new Date().toISOString();

  for (const pattern_family of CANONICAL_PATTERN_FAMILIES) {
    const tally = exitRunsByFamily.get(pattern_family)?.size ?? 0;
    const { error } = await supabase.from("pattern_states").upsert(
      {
        user_id: userId,
        pattern_family,
        window_run_ids: windowRunIds,
        family_window_tally: tally,
        updated_at: nowIso,
      },
      { onConflict: "user_id,pattern_family" },
    );
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
