import { arenaScenarioCopyFieldsFromUnknown } from "./arenaScenarioCopyFieldsFromUnknown";
import { arenaScenarioDescriptionLinesFromUnknown } from "./arenaScenarioDescriptionLinesFromUnknown";
import { arenaScenarioDifficultyFromUnknown } from "./arenaScenarioDifficultyFromUnknown";
import { arenaScenarioIdFromUnknown } from "./arenaScenarioIdFromUnknown";
import { arenaScenarioMissionChoiceRowsFromUnknown } from "./arenaScenarioMissionChoiceRowsFromUnknown";
import { arenaScenarioOutcomesFromUnknown } from "./arenaScenarioOutcomesFromUnknown";
import type { ArenaScenario } from "./types";

/**
 * Builds a full `ArenaScenario` from an untrusted object (e.g. API/JSON).
 * Composes sibling `*FromUnknown` helpers; **any** required slice failing → null.
 */
export function arenaScenarioFromUnknown(value: unknown): ArenaScenario | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;

  const id = arenaScenarioIdFromUnknown(o.id);
  if (id === null) return null;

  const copy = arenaScenarioCopyFieldsFromUnknown(value);
  if (copy === null) return null;

  const difficulty = arenaScenarioDifficultyFromUnknown(o.difficulty);
  if (difficulty === null) return null;

  const description = arenaScenarioDescriptionLinesFromUnknown(o.description);
  if (description === null) return null;

  const rows = arenaScenarioMissionChoiceRowsFromUnknown({
    primaryChoices: o.primaryChoices,
    reinforcementChoices: o.reinforcementChoices,
  });
  if (rows === null) return null;

  const outcomes = arenaScenarioOutcomesFromUnknown(o.outcomes);
  if (outcomes === null) return null;

  return {
    id,
    stage: copy.stage,
    caseTag: copy.caseTag,
    title: copy.title,
    difficulty,
    description,
    primaryChoices: rows.primaryChoices,
    reinforcementChoices: rows.reinforcementChoices,
    outcomes,
  };
}
