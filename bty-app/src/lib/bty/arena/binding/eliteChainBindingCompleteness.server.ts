import type { Scenario } from "@/lib/bty/scenario/types";

/**
 * Fail-closed: canonical elite chain POST `/api/arena/choice` must not proceed if JSON↔DB ids are incomplete.
 * @returns error code string for HTTP 422, or null when binding is complete.
 */
export function eliteChainScenarioBindingIncompleteReason(scenario: Scenario): string | null {
  for (const c of scenario.choices) {
    if (typeof c.dbChoiceId !== "string" || c.dbChoiceId.trim() === "") {
      return "primary_db_choice_missing";
    }
  }
  const eb = scenario.escalationBranches;
  if (eb == null || typeof eb !== "object") return "escalation_branches_missing";
  for (const [key, br] of Object.entries(eb)) {
    if (!Array.isArray(br.second_choices) || br.second_choices.length < 2) {
      return `second_choices_incomplete:${key}`;
    }
    for (const sc of br.second_choices) {
      if (typeof sc.dbChoiceId !== "string" || sc.dbChoiceId.trim() === "") {
        return `second_db_choice_missing:${key}`;
      }
    }
    const ad = br.action_decision;
    if (ad == null || !Array.isArray(ad.choices) || ad.choices.length === 0) {
      return `action_decision_missing:${key}`;
    }
    for (const ac of ad.choices) {
      if (typeof ac.dbChoiceId !== "string" || ac.dbChoiceId.trim() === "") {
        return `action_decision_db_missing:${key}`;
      }
    }
  }
  return null;
}
