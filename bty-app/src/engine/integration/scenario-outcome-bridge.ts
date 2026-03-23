/**
 * CHOICE_CONFIRMED → history row + XP gate + AIR write + Foundry session outcome.
 *
 * Persists to **public.user_scenario_choice_history** (see migration; aggregate `user_scenario_history` is separate).
 */

import { onAirWrite } from "@/engine/integrity/integrity-slip.monitor";
import {
  processSessionOutcome,
  type ArenaSessionResult,
  type ProcessSessionOutcomeDeps,
} from "@/engine/integration/arena-foundry-bridge";
import { handleMirrorTrigger } from "@/engine/integration/scenario-mirror-bridge";
import { validateXPAward, type XPAwardResult } from "@/engine/integration/xp-integrity-bridge";
import { adjustDifficultyFloorFromChoiceConfirmed } from "@/engine/scenario/scenario-difficulty-adjuster.service";
import { appendPlayedScenarioId } from "@/engine/scenario/user-scenario-played-append.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ChoiceConfirmedEvent = {
  scenarioId: string;
  choiceId: string;
  flagType: string;
  playedAt: Date;
  /** Amounts to validate before persistence (normalized [0,1] AIR in `sessionResult`). */
  xp: { core: number; weekly: number };
  sessionResult: ArenaSessionResult;
  /** AIR snapshot after choice — drives {@link onAirWrite}. */
  air: {
    newAir: number;
    previousAir: number | null;
    previousAirRecordedAt: Date | null;
  };
  now?: Date;
  processSessionOutcomeDeps?: ProcessSessionOutcomeDeps;
};

async function fetchScenarioTypeForScenario(scenarioId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) return "";
  const { data } = await admin
    .from("scenarios")
    .select("scenario_type")
    .eq("id", scenarioId)
    .eq("locale", "en")
    .maybeSingle();
  const st = (data as { scenario_type?: string } | null)?.scenario_type;
  return typeof st === "string" && st.trim() !== "" ? st.trim() : "";
}

async function insertUserScenarioChoiceHistory(row: {
  userId: string;
  scenarioId: string;
  choiceId: string;
  flagType: string;
  playedAt: Date;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("insertUserScenarioChoiceHistory: Supabase service role not configured");
  }
  const scenario_type = await fetchScenarioTypeForScenario(row.scenarioId);
  const { error } = await admin.from("user_scenario_choice_history").insert({
    user_id: row.userId,
    scenario_id: row.scenarioId,
    choice_id: row.choiceId,
    flag_type: row.flagType,
    played_at: row.playedAt.toISOString(),
    scenario_type,
  });
  if (error) throw error;
}

export type ChoiceConfirmedPipelineResult = {
  xpAwardCore: XPAwardResult;
  xpAwardWeekly: XPAwardResult;
};

/**
 * Single entry: CHOICE_CONFIRMED pipeline — history → validate XP (core + weekly) → AIR write → session outcome.
 */
export async function handleChoiceConfirmed(
  userId: string,
  event: ChoiceConfirmedEvent,
): Promise<ChoiceConfirmedPipelineResult> {
  await handleMirrorTrigger(userId, event);

  await insertUserScenarioChoiceHistory({
    userId,
    scenarioId: event.scenarioId,
    choiceId: event.choiceId,
    flagType: event.flagType,
    playedAt: event.playedAt,
  });

  await appendPlayedScenarioId(userId, event.scenarioId);

  const [xpAwardCore, xpAwardWeekly] = await Promise.all([
    validateXPAward(userId, "core", event.xp.core),
    validateXPAward(userId, "weekly", event.xp.weekly),
  ]);

  const now = event.now ?? new Date();
  await onAirWrite({
    userId,
    newAir: event.air.newAir,
    previousAir: event.air.previousAir,
    previousAirRecordedAt: event.air.previousAirRecordedAt,
    now,
  });

  await processSessionOutcome(userId, event.sessionResult, event.processSessionOutcomeDeps);

  try {
    const adminClient = getSupabaseAdmin();
    await adjustDifficultyFloorFromChoiceConfirmed(userId, event, adminClient ?? undefined);
  } catch (e) {
    console.warn("[handleChoiceConfirmed] adjustDifficultyFloorFromChoiceConfirmed", e);
  }

  return { xpAwardCore, xpAwardWeekly };
}
