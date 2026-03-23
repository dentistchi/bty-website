/**
 * {@link user_memory_trigger_queue} — scaffold inserts for pattern milestones.
 * Full delayed-outcome / perspective dispatch is **not** wired; consumers TBD.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { MemoryTriggerType } from "@/engine/memory/memory-engine.types";

export type EnqueueMemoryTriggerInput = {
  userId: string;
  triggerType: MemoryTriggerType;
  dueAt?: Date | null;
  payload?: Record<string, unknown>;
};

/**
 * Inserts a pending row. Idempotent guard: optional `payload.idempotency_key` can be checked by future workers.
 */
export async function enqueueMemoryTrigger(input: EnqueueMemoryTriggerInput): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("user_memory_trigger_queue")
    .insert({
      user_id: input.userId,
      trigger_type: input.triggerType,
      status: "pending",
      due_at: input.dueAt?.toISOString() ?? null,
      payload: (input.payload ?? {}) as unknown,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[enqueueMemoryTrigger]", error.message);
    return null;
  }
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Scaffold: enqueue `memory_pattern_threshold` when streak or total crosses simple thresholds.
 * Does **not** enqueue `delayed_outcome` (reserved for future wiring).
 */
export async function enqueuePatternThresholdIfEligible(input: {
  userId: string;
  flagType: string;
  totalCount: number;
  consecutiveCount: number;
  /** Scenario where the threshold-crossing choice occurred (for recall log `recalled_from_scenario_id`). */
  recalledFromScenarioId: string;
}): Promise<void> {
  const milestones: string[] = [];
  if (input.consecutiveCount === 3) milestones.push("consecutive_3");
  if (input.totalCount === 5) milestones.push("total_5");

  if (milestones.length === 0) return;

  await enqueueMemoryTrigger({
    userId: input.userId,
    triggerType: "memory_pattern_threshold",
    dueAt: null,
    payload: {
      flag_type: input.flagType,
      milestones,
      total_count: input.totalCount,
      consecutive_count: input.consecutiveCount,
      recalled_from_scenario_id: input.recalledFromScenarioId,
      idempotency_key: `${input.userId}:${input.flagType}:${milestones.join(",")}`,
    },
  });
}
