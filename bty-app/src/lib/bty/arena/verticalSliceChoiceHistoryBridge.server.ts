/**
 * OWN-RE-02-R1 vertical slice: `/api/arena/choice` records `arena_events` but not `user_scenario_choice_history`,
 * so deferred outcomes + REEXPOSURE_DUE never see a source row. This bridge inserts one history row per
 * successful **action_decision** binding submit (deduped per run window + choice id).
 */

import { VERTICAL_SLICE_CANONICAL_SCENARIO_ID } from "@/lib/bty/arena/eliteCanonicalRuntimeTruth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function flagTypeFromSecondTierPatternFamily(patternFamily: string | undefined): string {
  const f = (patternFamily ?? "").toLowerCase();
  if (f.includes("repair")) return "INTEGRITY_SLIP";
  if (f.includes("defer") || f.includes("future")) return "HERO_TRAP";
  if (f.includes("mirror") || f.includes("role")) return "ROLE_MIRROR";
  if (f.includes("clean")) return "CLEAN";
  return "INTEGRITY_SLIP";
}

/**
 * After `arena_events` + run sync succeed for binding `action_decision` on OWN-RE-02-R1.
 *
 * **played_at:** server clock at insert time (same convention as {@link handleChoiceConfirmed}).
 *
 * **Dedupe:** skips if a row already exists for the same user, literal `OWN-RE-02-R1` scenario_id,
 * same `json_choice_id`, and `played_at >= run.started_at` (same playthrough; blocks double-submit).
 */
export async function recordVerticalSliceActionDecisionHistory(params: {
  userId: string;
  dbScenarioId: string;
  jsonChoiceId: string;
  runStartedAtIso: string;
  secondTierPatternFamily: string | undefined;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  if (params.dbScenarioId !== VERTICAL_SLICE_CANONICAL_SCENARIO_ID) {
    return { ok: true, skipped: true };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("[verticalSliceChoiceHistoryBridge] admin unavailable");
    return { ok: false };
  }

  const scenario_id = VERTICAL_SLICE_CANONICAL_SCENARIO_ID;
  const played_at = new Date().toISOString();
  const flag_type = flagTypeFromSecondTierPatternFamily(params.secondTierPatternFamily);

  const { data: dup, error: dupErr } = await admin
    .from("user_scenario_choice_history")
    .select("id")
    .eq("user_id", params.userId)
    .eq("scenario_id", scenario_id)
    .eq("choice_id", params.jsonChoiceId)
    .gte("played_at", params.runStartedAtIso)
    .maybeSingle();

  if (dupErr) {
    console.error("[verticalSliceChoiceHistoryBridge] dedupe select failed", dupErr.message);
    return { ok: false };
  }
  if (dup?.id) {
    return { ok: true, skipped: true };
  }

  let scenario_type = "";
  const { data: stRow } = await admin
    .from("scenarios")
    .select("scenario_type")
    .eq("id", scenario_id)
    .eq("locale", "en")
    .maybeSingle();
  scenario_type =
    typeof (stRow as { scenario_type?: string } | null)?.scenario_type === "string"
      ? String((stRow as { scenario_type: string }).scenario_type).trim()
      : "";

  const { error: insErr } = await admin.from("user_scenario_choice_history").insert({
    user_id: params.userId,
    scenario_id,
    choice_id: params.jsonChoiceId,
    flag_type,
    played_at,
    scenario_type: scenario_type !== "" ? scenario_type : "elite_vertical_slice",
    outcome_triggered: false,
  });

  if (insErr) {
    console.error("[verticalSliceChoiceHistoryBridge] insert failed", insErr.message);
    return { ok: false };
  }

  return { ok: true };
}
