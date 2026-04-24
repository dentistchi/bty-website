import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";
import { eliteScenarioToScenario, getEliteScenarioById } from "@/lib/bty/arena/eliteScenariosCanonical.server";

/**
 * All primary + second-choice `dbChoiceId` values for an elite scenario (chain catalog).
 * Returns null if scenario is not in the canonical elite map.
 */
export function allowedDbChoiceIdsForEliteScenario(dbScenarioId: string): string[] | null {
  if (!isEliteChainScenarioId(dbScenarioId)) return null;
  try {
    const elite = getEliteScenarioById(dbScenarioId);
    const sc = eliteScenarioToScenario(elite, "en");
    const ids: string[] = [];
    for (const c of sc.choices) {
      if (typeof c.dbChoiceId === "string" && c.dbChoiceId.trim() !== "") ids.push(c.dbChoiceId);
    }
    const eb = sc.escalationBranches;
    if (eb) {
      for (const br of Object.values(eb)) {
        for (const s of br.second_choices) {
          if (typeof s.dbChoiceId === "string" && s.dbChoiceId.trim() !== "") ids.push(s.dbChoiceId);
        }
      }
    }
    return ids;
  } catch {
    return null;
  }
}
