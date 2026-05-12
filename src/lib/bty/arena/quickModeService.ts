/**
 * Quick Mode service — lightweight scenario → decision → action flow.
 * No action contract chain; single scenario, no 7-step flow.
 * XP awarded only when actionCompleted = true (QUICK_MODE_COMPLETE activity).
 * Ref: QUICK_MODE_PATTERN_TYPE_SPEC_V1
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scenario } from "@/lib/bty/scenario/types";
import {
  selectNextScenario,
  type ScenarioLocalePreference,
} from "@/engine/scenario/scenario-selector.service";
import { recordActivityXp } from "./activityXp";
import {
  buildIntentRow,
  buildActionRow,
  buildAbandonmentRow,
  shouldTriggerAbandonmentSignal,
  type PatternHistoryRow,
} from "@/domain/pattern/patternHistory";

export type QuickScenarioResult =
  | { ok: true; scenario: Scenario; intentId: string }
  | { ok: false; error: string };

export type QuickCompleteResult =
  | { ok: true; xpAwarded: number; abandonmentTriggered: boolean }
  | { ok: false; error: string };

/** Select a single scenario for Quick Mode and record the intent row. */
export async function selectAndRecordQuickScenario(
  supabase: SupabaseClient,
  userId: string,
  locale: ScenarioLocalePreference
): Promise<QuickScenarioResult> {
  let scenario: Scenario;
  try {
    scenario = await selectNextScenario(userId, locale);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "scenario_select_failed" };
  }

  const row = buildIntentRow({
    userId,
    scenarioId: scenario.dbScenarioId ?? scenario.scenarioId,
    sourceMode: "quick_mode",
    axis: (scenario as { axis?: string }).axis,
  });

  const { data: inserted, error: insErr } = await supabase
    .from("user_pattern_history")
    .insert(row)
    .select("id")
    .single();

  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  return { ok: true, scenario, intentId: (inserted as { id: string }).id };
}

/**
 * Record action completion for a Quick Mode scenario.
 * If actionCompleted=true: inserts action row, awards XP, checks abandonment.
 * If actionCompleted=false: no XP, no action row (intent already recorded at start).
 */
export async function completeQuickAction(
  supabase: SupabaseClient,
  userId: string,
  scenarioId: string,
  opts?: { axis?: string; actionCompleted?: boolean }
): Promise<QuickCompleteResult> {
  const actionCompleted = opts?.actionCompleted ?? false;

  if (!actionCompleted) {
    return { ok: true, xpAwarded: 0, abandonmentTriggered: false };
  }

  const row = buildActionRow({
    userId,
    scenarioId,
    sourceMode: "quick_mode",
    axis: opts?.axis,
  });

  const { error: insErr } = await supabase.from("user_pattern_history").insert(row);
  if (insErr) return { ok: false, error: insErr.message };

  const xpResult = await recordActivityXp(supabase, userId, "QUICK_MODE_COMPLETE");
  const xpAwarded = xpResult.ok ? xpResult.xp : 0;

  // Check abandonment signal
  const abandonmentTriggered = await checkAndRecordAbandonmentSignal(supabase, userId, scenarioId);

  return { ok: true, xpAwarded, abandonmentTriggered };
}

/** Check recent pattern history for abandonment threshold; insert signal row if triggered. */
async function checkAndRecordAbandonmentSignal(
  supabase: SupabaseClient,
  userId: string,
  scenarioId: string
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("user_pattern_history")
    .select("id, user_id, scenario_id, pattern_type, source_mode, axis, action_completed, air_eligible, weight, created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return false;

  if (!shouldTriggerAbandonmentSignal(rows as PatternHistoryRow[])) return false;

  const signalRow = buildAbandonmentRow({ userId, scenarioId });
  await supabase.from("user_pattern_history").insert(signalRow).then(() => undefined);

  return true;
}

/** Get the most recent unfinished quick intent (scenario chosen but action not completed). */
export async function getLatestQuickIntent(
  supabase: SupabaseClient,
  userId: string
): Promise<{ scenarioId: string; intentId: string } | null> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24h window

  const { data } = await supabase
    .from("user_pattern_history")
    .select("id, scenario_id")
    .eq("user_id", userId)
    .eq("pattern_type", "intent")
    .eq("source_mode", "quick_mode")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as { id: string; scenario_id: string };

  // Check if it was already completed
  const { count } = await supabase
    .from("user_pattern_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("scenario_id", row.scenario_id)
    .eq("pattern_type", "action")
    .eq("source_mode", "quick_mode");

  if ((count ?? 0) > 0) return null; // already completed

  return { scenarioId: row.scenario_id, intentId: row.id };
}
