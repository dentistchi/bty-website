/**
 * Persist append-only {@link user_behavior_memory_events} rows.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { MemoryEventSource } from "@/engine/memory/memory-engine.types";

export type InsertMemoryEventInput = {
  userId: string;
  scenarioId: string;
  choiceId: string;
  flagType: string;
  playedAt: Date;
  source?: MemoryEventSource;
  payload?: Record<string, unknown>;
};

export async function insertBehaviorMemoryEvent(input: InsertMemoryEventInput): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("user_behavior_memory_events")
    .insert({
      user_id: input.userId,
      scenario_id: input.scenarioId,
      choice_id: input.choiceId,
      flag_type: input.flagType,
      played_at: input.playedAt.toISOString(),
      source: input.source ?? "arena_choice_confirmed",
      payload: (input.payload ?? {}) as unknown,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[insertBehaviorMemoryEvent]", error.message);
    return null;
  }
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" ? id : null;
}
