import type { SupabaseClient } from "@supabase/supabase-js";
import { PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD } from "@/domain/pattern-family";
import { syncPatternStatesForUser } from "./syncPatternStates";

/**
 * When any canonical family has `family_window_tally` ≥ threshold, returns the family that
 * should receive the next contract per **recency tie-break** (`PATTERN_ACTION_MODEL_V1.md` §3).
 */
export async function resolvePatternFamilyForContractTrigger(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const sync = await syncPatternStatesForUser(supabase, userId);
  if (!sync.ok) return null;

  const { data: states, error } = await supabase
    .from("pattern_states")
    .select("pattern_family, family_window_tally, window_run_ids")
    .eq("user_id", userId);

  if (error) return null;

  const atThreshold = (states ?? []).filter(
    (row) => Number((row as { family_window_tally?: unknown }).family_window_tally) >= PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD,
  );
  if (atThreshold.length === 0) return null;
  if (atThreshold.length === 1) {
    const fam = (atThreshold[0] as { pattern_family?: string }).pattern_family;
    return typeof fam === "string" && fam.length > 0 ? fam : null;
  }

  const families = atThreshold
    .map((r) => (r as { pattern_family?: string }).pattern_family)
    .filter((f): f is string => typeof f === "string" && f.length > 0);

  const windowRunIdsRaw = (atThreshold[0] as { window_run_ids?: unknown }).window_run_ids;
  const windowRunIds = Array.isArray(windowRunIdsRaw)
    ? windowRunIdsRaw.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (windowRunIds.length === 0) return families[0] ?? null;

  const { data: sigs, error: sigErr } = await supabase
    .from("pattern_signals")
    .select("pattern_family, recorded_at")
    .eq("user_id", userId)
    .eq("direction", "exit")
    .in("pattern_family", families)
    .in("run_id", windowRunIds);

  if (sigErr || !sigs?.length) return families[0] ?? null;

  const latestByFamily = new Map<string, string>();
  for (const row of sigs) {
    const fam = (row as { pattern_family?: string }).pattern_family;
    const rec = (row as { recorded_at?: string }).recorded_at;
    if (typeof fam !== "string" || typeof rec !== "string") continue;
    const prev = latestByFamily.get(fam);
    if (!prev || rec > prev) latestByFamily.set(fam, rec);
  }

  let bestFamily = families[0]!;
  let bestTs = "";
  for (const f of families) {
    const ts = latestByFamily.get(f) ?? "";
    if (ts > bestTs) {
      bestTs = ts;
      bestFamily = f;
    }
  }
  return bestFamily;
}
