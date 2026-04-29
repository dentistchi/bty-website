import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import { rowToArenaSignal, rowToReflectionEntry, type BtyArenaSignalRow, type BtyReflectionEntryRow } from "./mappers";

export async function fetchSignalsAndReflections(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; signals: ArenaSignal[]; reflections: ReflectionEntry[] }
  | { ok: false; message: string }
> {
  const { data: signalRows, error: sigErr } = await supabase
    .from("bty_arena_signals")
    .select("id, scenario_id, primary_choice, reinforcement_choice, traits, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (sigErr) return { ok: false, message: sigErr.message };

  const { data: reflectionRows, error: refErr } = await supabase
    .from("bty_reflection_entries")
    .select(
      "id, seed_id, scenario_id, focus, prompt_title, prompt_body, cue, answer_1, answer_2, answer_3, commitment, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (refErr) return { ok: false, message: refErr.message };

  const signals = (signalRows ?? []).map((r) => rowToArenaSignal(r as BtyArenaSignalRow));
  const reflections = (reflectionRows ?? []).map((r) => rowToReflectionEntry(r as BtyReflectionEntryRow));

  return { ok: true, signals, reflections };
}
