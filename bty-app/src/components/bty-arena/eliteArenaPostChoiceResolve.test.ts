import { describe, it, expect } from "vitest";
import { resolveEliteEscalationBranch } from "./eliteArenaPostChoiceResolve";
import type { Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";

describe("resolveEliteEscalationBranch", () => {
  const choice: ScenarioChoice = {
    choiceId: "A",
    label: "A",
    intent: "i",
    xpBase: 1,
    difficulty: 1,
    hiddenDelta: {},
    result: "r",
    microInsight: "m",
  };

  it("returns invalid_second_choice_cost when a second choice has empty cost", () => {
    const scenario = {
      scenarioId: "s",
      title: "t",
      context: "c",
      eliteSetup: { role: "r", pressure: "p", tradeoff: "d" },
      choices: [choice],
      escalationBranches: {
        A: {
          escalation_text: "line",
          pressure_increase: 0.2,
          second_choices: [
            { id: "X", label: "X", cost: " ", direction: "exit" as const },
            { id: "Y", label: "Y", cost: "valid", direction: "entry" as const },
          ],
        },
      },
    } as unknown as Scenario;
    expect(resolveEliteEscalationBranch(scenario, choice).kind).toBe("invalid_second_choice_cost");
  });

  it("returns ok when costs are non-empty", () => {
    const scenario = {
      scenarioId: "s",
      title: "t",
      context: "c",
      eliteSetup: { role: "r", pressure: "p", tradeoff: "d" },
      choices: [choice],
      escalationBranches: {
        A: {
          escalation_text: "line",
          pressure_increase: 0.2,
          second_choices: [
            { id: "X", label: "X", cost: "c1", direction: "exit" as const },
            { id: "Y", label: "Y", cost: "c2", direction: "entry" as const },
          ],
        },
      },
    } as unknown as Scenario;
    const r = resolveEliteEscalationBranch(scenario, choice);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.branch.second_choices).toHaveLength(2);
    }
  });
});
