import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecondChoice } from "@/domain/arena/scenarios/types";
import { isCanonicalPatternFamily, normalizePatternFamilyId } from "@/domain/pattern-family";
import { recordPatternSignal } from "./recordPatternSignal";
import { syncPatternStatesForUser } from "./syncPatternStates";

/**
 * v2 pattern detection: signals come only from `second_choice.direction` + `second_choice.pattern_family`
 * at Step 4 finalization (`POST /api/arena/run/step`). No reinforcement / stance / client `pattern_signal`.
 */
export function validateSecondChoicePatternSignalInputV2(picked: SecondChoice): string | null {
  if (picked.direction !== "entry" && picked.direction !== "exit") {
    return "invalid_second_choice_direction";
  }
  if (picked.direction === "exit") {
    const raw = picked.pattern_family?.trim() ?? "";
    if (!raw) return "missing_pattern_family";
    const n = normalizePatternFamilyId(raw);
    if (!n || !isCanonicalPatternFamily(n)) return "invalid_pattern_family";
  }
  return null;
}

export type RecordExitSecondChoicePatternSignalV2Result =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Inserts one exit `pattern_signals` row (per-run cap) and refreshes tallies. Caller must have passed {@link validateSecondChoicePatternSignalInputV2}.
 */
export async function recordExitSecondChoicePatternSignalV2(
  supabase: SupabaseClient,
  args: {
    runId: string;
    userId: string;
    second_choice_id: string;
    patternFamilyRaw: string;
  },
): Promise<RecordExitSecondChoicePatternSignalV2Result> {
  const sig = await recordPatternSignal(supabase, {
    runId: args.runId,
    userId: args.userId,
    patternFamilyRaw: args.patternFamilyRaw,
    direction: "exit",
    step: 4,
    payload: { second_choice_id: args.second_choice_id, source: "second_choice_v2" },
  });
  if (!sig.ok) return { ok: false, error: sig.error };

  const sync = await syncPatternStatesForUser(supabase, args.userId);
  if (!sync.ok) {
    console.warn("[pattern_signal v2 second_choice] sync_pattern_states_failed", { message: sync.error });
  }

  const normalized = normalizePatternFamilyId(args.patternFamilyRaw);
  let family_window_tally: number | null = null;
  if (normalized && isCanonicalPatternFamily(normalized)) {
    const { data } = await supabase
      .from("pattern_states")
      .select("family_window_tally")
      .eq("user_id", args.userId)
      .eq("pattern_family", normalized)
      .maybeSingle();
    family_window_tally = Number(
      (data as { family_window_tally?: number } | null)?.family_window_tally ?? 0,
    );
  }

  console.log("[pattern_signal v2 second_choice]", {
    second_choice_id: args.second_choice_id,
    direction: "exit",
    pattern_family: normalized ?? args.patternFamilyRaw.trim(),
    family_window_tally,
    duplicate: sig.duplicate,
  });

  return { ok: true, duplicate: sig.duplicate };
}
