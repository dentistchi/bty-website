import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalPatternFamily, normalizePatternFamilyId } from "@/domain/pattern-family";

export type PatternDirection = "entry" | "exit";

export type RecordPatternSignalResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Inserts one pattern_signal row. DB partial unique index enforces per-run cap (ENGINE §5 rule 2).
 */
export async function recordPatternSignal(
  supabase: SupabaseClient,
  params: {
    runId: string;
    userId: string;
    patternFamilyRaw: string;
    direction: PatternDirection;
    step: number;
    intensity?: 1 | 2 | 3;
    payload?: Record<string, unknown>;
  },
): Promise<RecordPatternSignalResult> {
  const pattern_family = normalizePatternFamilyId(params.patternFamilyRaw);
  if (!pattern_family || !isCanonicalPatternFamily(pattern_family)) {
    return { ok: false, error: "invalid_pattern_family" };
  }
  if (params.step < 2 || params.step > 4) {
    return { ok: false, error: "step_outside_pattern_range" };
  }

  const { error } = await supabase.from("pattern_signals").insert({
    run_id: params.runId,
    user_id: params.userId,
    pattern_family,
    direction: params.direction,
    step: params.step,
    intensity: params.intensity ?? null,
    payload: params.payload ?? {},
  });

  if (!error) return { ok: true, duplicate: false };

  const code = (error as { code?: string }).code;
  if (code === "23505") {
    return { ok: true, duplicate: true };
  }
  return { ok: false, error: error.message };
}
