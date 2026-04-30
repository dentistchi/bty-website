import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_PATTERN_FAMILIES } from "@/domain/pattern-family";

const WINDOW_SIZE = 7;

/** `reached_step_2_at IS NOT NULL` — use `>=` so `NULL` rows are excluded (same as `.not(col, "is", null)` on timestamptz). */
const MIN_TIMESTAMPTZ_ISO = new Date(0).toISOString();

type PatternStateRow = {
  user_id: string;
  pattern_family: string;
  window_run_ids: string[];
  /** Count of distinct runs in window with ≥1 exit signal for this family. */
  family_window_tally: number;
  /** Count of distinct runs in window with ≥1 entry signal for this family. */
  entry_count: number;
  /** Weighted pressure: (exit_count × 2) + entry_count. Used by Integrity Gap trigger. */
  pressure_score: number;
  updated_at: string;
};

/** Real `SupabaseClient` always has `.upsert`; minimal test doubles may omit it — use `insert` then. */
async function upsertPatternStateRow(
  supabase: SupabaseClient,
  payload: PatternStateRow,
): Promise<{ error: { message: string } | null }> {
  const table = supabase.from("pattern_states");
  const t = table as unknown as {
    upsert?: (
      data: PatternStateRow,
      opts?: { onConflict?: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
    insert: (data: PatternStateRow) => PromiseLike<{ error: { message: string } | null }>;
  };
  if (typeof t.upsert === "function") {
    return await t.upsert(payload, { onConflict: "user_id,pattern_family" });
  }
  return await t.insert(payload);
}

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
    .gte("reached_step_2_at", MIN_TIMESTAMPTZ_ISO)
    .order("started_at", { ascending: false })
    .limit(WINDOW_SIZE);

  if (runErr) return { ok: false, error: runErr.message };

  const windowRunIds = (runs ?? [])
    .map((r) => (r as { run_id?: string }).run_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (windowRunIds.length === 0) {
    for (const pattern_family of CANONICAL_PATTERN_FAMILIES) {
      const { error } = await upsertPatternStateRow(supabase, {
        user_id: userId,
        pattern_family,
        window_run_ids: [],
        family_window_tally: 0,
        entry_count: 0,
        pressure_score: 0,
        updated_at: new Date().toISOString(),
      });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { data: signals, error: sigErr } = await supabase
    .from("pattern_signals")
    .select("run_id, pattern_family, direction")
    .eq("user_id", userId)
    .in("run_id", windowRunIds);

  if (sigErr) return { ok: false, error: sigErr.message };

  const windowSet = new Set(windowRunIds);
  const exitRunsByFamily = new Map<string, Set<string>>();
  const entryRunsByFamily = new Map<string, Set<string>>();
  for (const row of signals ?? []) {
    const runId = (row as { run_id?: string }).run_id;
    const fam = (row as { pattern_family?: string }).pattern_family;
    const dir = (row as { direction?: string }).direction;
    if (typeof runId !== "string" || typeof fam !== "string" || typeof dir !== "string") continue;
    if (!windowSet.has(runId)) continue;
    if (dir === "exit") {
      if (!exitRunsByFamily.has(fam)) exitRunsByFamily.set(fam, new Set());
      exitRunsByFamily.get(fam)!.add(runId);
    } else if (dir === "entry") {
      if (!entryRunsByFamily.has(fam)) entryRunsByFamily.set(fam, new Set());
      entryRunsByFamily.get(fam)!.add(runId);
    }
  }

  const nowIso = new Date().toISOString();

  for (const pattern_family of CANONICAL_PATTERN_FAMILIES) {
    const exitCount = exitRunsByFamily.get(pattern_family)?.size ?? 0;
    const entryCount = entryRunsByFamily.get(pattern_family)?.size ?? 0;
    const pressureScore = exitCount * 2 + entryCount;
    const { error } = await upsertPatternStateRow(supabase, {
      user_id: userId,
      pattern_family,
      window_run_ids: windowRunIds,
      family_window_tally: exitCount,
      entry_count: entryCount,
      pressure_score: pressureScore,
      updated_at: nowIso,
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
