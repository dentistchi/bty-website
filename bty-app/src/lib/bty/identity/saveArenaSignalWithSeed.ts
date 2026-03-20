import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReflectionSeed } from "@/features/growth/logic";
import type { ArenaSignal } from "@/features/my-page/logic/types";

export type SaveArenaSignalInput = {
  userId: string;
  scenarioId: string;
  primaryChoice: string;
  reinforcementChoice: string;
  traits: Record<string, number>;
  meta: ArenaSignal["meta"];
};

/**
 * Persists one Arena signal and the derived reflection seed in a single flow (API transaction substitute: two inserts).
 */
export async function saveArenaSignalWithSeed(
  supabase: SupabaseClient,
  input: SaveArenaSignalInput,
): Promise<
  { ok: true; signalId: string; seedId: string } | { ok: false; message: string }
> {
  const signal: ArenaSignal = {
    scenarioId: input.scenarioId,
    primary: input.primaryChoice,
    reinforcement: input.reinforcementChoice,
    traits: input.traits,
    meta: input.meta,
    timestamp: Date.now(),
  };

  const { data: insertedSignal, error: signalError } = await supabase
    .from("bty_arena_signals")
    .insert({
      user_id: input.userId,
      scenario_id: input.scenarioId,
      primary_choice: input.primaryChoice,
      reinforcement_choice: input.reinforcementChoice,
      traits: input.traits,
      meta: input.meta,
    })
    .select("id")
    .single();

  if (signalError || !insertedSignal) {
    return { ok: false, message: signalError?.message ?? "Failed to insert arena signal" };
  }

  const seed = buildReflectionSeed(signal);

  const { data: insertedSeed, error: seedError } = await supabase
    .from("bty_reflection_seeds")
    .insert({
      user_id: input.userId,
      source: "arena",
      scenario_id: seed.scenarioId,
      primary_choice: seed.primary,
      reinforcement_choice: seed.reinforcement,
      focus: seed.focus,
      prompt_title: seed.promptTitle,
      prompt_body: seed.promptBody,
      cue: seed.cue,
    })
    .select("id")
    .single();

  if (seedError || !insertedSeed) {
    return { ok: false, message: seedError?.message ?? "Failed to insert reflection seed" };
  }

  return { ok: true, signalId: insertedSignal.id as string, seedId: insertedSeed.id as string };
}
