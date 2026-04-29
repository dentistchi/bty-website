import { arenaMissionOutcomeKeyPartsFromUnknown } from "./arenaMissionOutcomeKey";
import type { ArenaScenario } from "./types";

/**
 * Lists structural problems between `scenario.outcomes` keys and the scenario's choice ids.
 * Does not validate resolve payloads — only that each key is a valid `primary_reinforcement`
 * token pair and that both ids appear on `primaryChoices` / `reinforcementChoices`.
 *
 * Empty array ⇒ no violations (keys align with declared choices).
 */
export function listArenaScenarioOutcomeKeyViolations(
  scenario: ArenaScenario,
): readonly string[] {
  const primaryIds = new Set(scenario.primaryChoices.map((c) => c.id));
  const reinforcementIds = new Set(scenario.reinforcementChoices.map((c) => c.id));
  const violations: string[] = [];

  for (const key of Object.keys(scenario.outcomes)) {
    const parts = arenaMissionOutcomeKeyPartsFromUnknown(key);
    if (parts === null) {
      violations.push(`invalid_outcome_key:${key}`);
      continue;
    }
    if (!primaryIds.has(parts.primaryId)) {
      violations.push(`primary_not_in_scenario:${key}`);
    }
    if (!reinforcementIds.has(parts.reinforcementId)) {
      violations.push(`reinforcement_not_in_scenario:${key}`);
    }
  }

  return violations.slice().sort((a, b) => a.localeCompare(b));
}
