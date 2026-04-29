/**
 * Elite Step 5 — Pattern Mirror copy: **v2 only** (`pattern_signals` exit + `pattern_states`).
 * Does **not** use AIR (`le_activation_log`), stance, reinforcement, or behavior-pattern choice history.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_PATTERN_FAMILIES, type CanonicalPatternFamily } from "@/domain/pattern-family";

const FAMILY_LABEL_EN: Record<CanonicalPatternFamily, string> = {
  ownership_escape: "ownership escape",
  repair_avoidance: "repair avoidance",
  explanation_substitution: "explanation substitution",
  delegation_deflection: "delegation deflection",
  future_deferral: "future deferral",
};

function labelForFamily(f: string): string {
  return (CANONICAL_PATTERN_FAMILIES as readonly string[]).includes(f)
    ? FAMILY_LABEL_EN[f as CanonicalPatternFamily]
    : f;
}

/**
 * Builds neutral mirror text from v2 signals for the current run + rolling window state.
 */
export async function buildElitePatternMirrorNarrativeV2(
  userId: string,
  runId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const lines: string[] = [];

  const { data: runSigs, error: sigErr } = await supabase
    .from("pattern_signals")
    .select("pattern_family, direction, step")
    .eq("user_id", userId)
    .eq("run_id", runId)
    .eq("direction", "exit")
    .order("recorded_at", { ascending: true });

  if (!sigErr && runSigs?.length) {
    for (const row of runSigs) {
      const fam = (row as { pattern_family?: string }).pattern_family;
      if (typeof fam !== "string" || !fam.trim()) continue;
      lines.push(
        `This run recorded an exit signal for pattern family “${labelForFamily(fam.trim())}”.`,
      );
    }
  }

  const { data: states, error: stErr } = await supabase
    .from("pattern_states")
    .select("pattern_family, family_window_tally")
    .eq("user_id", userId);

  if (!stErr && states?.length) {
    const tallies = (states as { pattern_family?: string; family_window_tally?: number }[])
      .filter((s) => typeof s.pattern_family === "string" && Number(s.family_window_tally) > 0)
      .sort((a, b) => String(a.pattern_family).localeCompare(String(b.pattern_family)));

    if (tallies.length > 0) {
      const parts = tallies.map(
        (s) =>
          `“${labelForFamily(String(s.pattern_family))}”: ${Math.floor(Number(s.family_window_tally))} qualifying exit(s) in the current window`,
      );
      lines.push(`Accumulated pattern window: ${parts.join("; ")}.`);
    }
  }

  if (lines.length === 0) {
    return "";
  }
  return lines.join("\n\n");
}
