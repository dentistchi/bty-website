/**
 * Mirror scenario pool — queue a follow-up reflection scenario when Arena session AIR declines.
 * Persisted for Foundry / Safe Mirror routing; insert uses service role.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type MirrorScenarioPoolInsert = {
  userId: string;
  scenarioType: string;
  airDelta: number;
  /** Provenance (default `arena_session_end`). */
  source?: string;
};

/**
 * Queue one row in `mirror_scenario_pool` for deferred mirror / follow-up content.
 */
export async function queueMirrorScenarioPoolEntry(input: MirrorScenarioPoolInsert): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("queueMirrorScenarioPoolEntry: Supabase service role not configured");
  }
  const { error } = await admin.from("mirror_scenario_pool").insert({
    user_id: input.userId,
    scenario_type: input.scenarioType,
    air_delta: input.airDelta,
    source: input.source ?? "arena_session_end",
  });
  if (error) throw error;
}
