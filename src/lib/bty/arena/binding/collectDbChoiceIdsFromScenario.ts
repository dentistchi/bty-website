import type { Scenario } from "@/lib/bty/scenario/types";

/** All `dbChoiceId` values declared on the scenario payload (primary + escalation second choices). */
export function collectDbChoiceIdsFromScenario(scenario: Scenario): string[] {
  const ids: string[] = [];
  for (const c of scenario.choices) {
    if (typeof c.dbChoiceId === "string" && c.dbChoiceId.trim() !== "") ids.push(c.dbChoiceId);
  }
  const eb = scenario.escalationBranches;
  if (eb) {
    for (const br of Object.values(eb)) {
      for (const sc of br.second_choices) {
        if (typeof sc.dbChoiceId === "string" && sc.dbChoiceId.trim() !== "") ids.push(sc.dbChoiceId);
      }
    }
  }
  return ids;
}
