import type { ReflectionSeed } from "./buildReflectionSeed";
import type { ReflectionEntry } from "./types";

export function buildReflectionEntry({
  seed,
  answer1,
  answer2,
  answer3,
  commitment,
}: {
  seed: ReflectionSeed;
  answer1: string;
  answer2: string;
  answer3: string;
  commitment: string;
}): ReflectionEntry {
  const id = `${seed.scenarioId}-${seed.createdAt}-${Date.now()}`;

  return {
    id,
    source: "arena",
    scenarioId: seed.scenarioId,
    focus: seed.focus,
    promptTitle: seed.promptTitle,
    promptBody: seed.promptBody,
    cue: seed.cue,
    answer1: answer1.trim(),
    answer2: answer2.trim(),
    answer3: answer3.trim(),
    commitment: commitment.trim(),
    createdAt: Date.now(),
  };
}
