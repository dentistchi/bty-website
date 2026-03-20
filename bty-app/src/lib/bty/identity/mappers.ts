import type { ReflectionEntry } from "@/features/growth/logic/types";
import type { ArenaSignal } from "@/features/my-page/logic/types";

/** DB row shape for `public.bty_arena_signals` (subset used by app). */
export type BtyArenaSignalRow = {
  id: string;
  scenario_id: string;
  primary_choice: string;
  reinforcement_choice: string;
  traits: Record<string, number>;
  meta: {
    relationalBias: number;
    operationalBias: number;
    emotionalRegulation: number;
  };
  created_at: string;
};

/** DB row for `public.bty_reflection_seeds`. */
export type BtyReflectionSeedRow = {
  id: string;
  source: "arena";
  scenario_id: string;
  primary_choice: string;
  reinforcement_choice: string;
  focus: ReflectionEntry["focus"];
  prompt_title: string;
  prompt_body: string;
  cue: string;
  created_at: string;
};

/** DB row for `public.bty_reflection_entries`. */
export type BtyReflectionEntryRow = {
  id: string;
  seed_id: string | null;
  scenario_id: string;
  focus: ReflectionEntry["focus"];
  prompt_title: string;
  prompt_body: string;
  cue: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  commitment: string;
  created_at: string;
};

export function rowToArenaSignal(row: BtyArenaSignalRow): ArenaSignal {
  return {
    scenarioId: row.scenario_id,
    primary: row.primary_choice,
    reinforcement: row.reinforcement_choice,
    traits: row.traits,
    meta: row.meta,
    timestamp: new Date(row.created_at).getTime(),
  };
}

export function rowToReflectionEntry(row: BtyReflectionEntryRow): ReflectionEntry {
  return {
    id: row.id,
    source: "arena",
    scenarioId: row.scenario_id,
    focus: row.focus,
    promptTitle: row.prompt_title,
    promptBody: row.prompt_body,
    cue: row.cue,
    answer1: row.answer_1,
    answer2: row.answer_2,
    answer3: row.answer_3,
    commitment: row.commitment,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function seedRowToClientSeed(row: BtyReflectionSeedRow) {
  return {
    id: row.id,
    source: "arena" as const,
    scenarioId: row.scenario_id,
    primary: row.primary_choice,
    reinforcement: row.reinforcement_choice,
    focus: row.focus,
    promptTitle: row.prompt_title,
    promptBody: row.prompt_body,
    cue: row.cue,
    createdAt: new Date(row.created_at).getTime(),
  };
}
