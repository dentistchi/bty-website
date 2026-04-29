import type { EscalationBranch } from "@/domain/arena/scenarios/types";
import type { Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";

export type ElitePostChoiceResolution =
  | { kind: "ok"; branch: EscalationBranch }
  | { kind: "escalation_not_configured" }
  | { kind: "missing_escalation_branch" }
  | { kind: "invalid_second_choice_cost" };

function hasEscalationDataset(s: Scenario): boolean {
  const eb = s.escalationBranches;
  return Boolean(eb && typeof eb === "object" && !Array.isArray(eb) && Object.keys(eb).length > 0);
}

/** Resolves `escalationBranches[primaryChoiceId]` for steps 3–4 only. */
export function resolveEliteEscalationBranch(
  scenario: Scenario,
  choice: ScenarioChoice,
): ElitePostChoiceResolution {
  if (!scenario.eliteSetup || !hasEscalationDataset(scenario)) {
    return { kind: "escalation_not_configured" };
  }
  const b = scenario.escalationBranches![choice.choiceId];
  if (!b?.escalation_text?.trim()) {
    return { kind: "missing_escalation_branch" };
  }
  if (!Array.isArray(b.second_choices) || b.second_choices.length === 0) {
    return { kind: "missing_escalation_branch" };
  }
  for (const sc of b.second_choices) {
    if (typeof sc.cost !== "string" || sc.cost.trim() === "") {
      return { kind: "invalid_second_choice_cost" };
    }
  }
  return { kind: "ok", branch: b };
}
