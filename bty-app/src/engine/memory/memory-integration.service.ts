/**
 * Orchestrates memory recording + pattern aggregation on CHOICE_CONFIRMED.
 */

import { insertBehaviorMemoryEvent } from "@/engine/memory/memory-record.service";
import { aggregateRepeatedFlagTypes } from "@/engine/memory/memory-pattern-aggregation.service";
import { enqueuePatternThresholdIfEligible } from "@/engine/memory/memory-trigger-queue.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ChoiceConfirmedMemoryPayload } from "@/engine/memory/memory-engine.types";

async function readCountsForFlag(
  userId: string,
  flagType: string,
): Promise<{ total: number; consecutive: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { total: 0, consecutive: 0 };

  const tk = `flag_total:${flagType}`;
  const ck = `flag_consecutive:${flagType}`;

  const [{ data: t }, { data: c }] = await Promise.all([
    admin.from("user_behavior_pattern_state").select("total_count").eq("user_id", userId).eq("pattern_key", tk).maybeSingle(),
    admin.from("user_behavior_pattern_state").select("consecutive_count").eq("user_id", userId).eq("pattern_key", ck).maybeSingle(),
  ]);

  const total = typeof (t as { total_count?: number } | null)?.total_count === "number"
    ? (t as { total_count: number }).total_count
    : 0;
  const consecutive = typeof (c as { consecutive_count?: number } | null)?.consecutive_count === "number"
    ? (c as { consecutive_count: number }).consecutive_count
    : 0;

  return { total, consecutive };
}

/**
 * Called from {@link handleChoiceConfirmed} after scenario choice history is persisted.
 * Failures are logged only — must not break XP / AIR pipeline.
 */
export async function recordChoiceConfirmedMemory(
  userId: string,
  payload: ChoiceConfirmedMemoryPayload,
): Promise<void> {
  try {
    await insertBehaviorMemoryEvent({
      userId,
      scenarioId: payload.scenarioId,
      choiceId: payload.choiceId,
      flagType: payload.flagType,
      playedAt: payload.playedAt,
      source: "arena_choice_confirmed",
      payload: { phase: "choice_confirmed" },
    });

    await aggregateRepeatedFlagTypes(userId, payload.flagType, payload.playedAt);

    const { total, consecutive } = await readCountsForFlag(userId, payload.flagType);
    await enqueuePatternThresholdIfEligible({
      userId,
      flagType: payload.flagType,
      totalCount: total,
      consecutiveCount: consecutive,
      recalledFromScenarioId: payload.scenarioId,
    });
  } catch (e) {
    console.warn("[recordChoiceConfirmedMemory]", e instanceof Error ? e.message : e);
  }
}
