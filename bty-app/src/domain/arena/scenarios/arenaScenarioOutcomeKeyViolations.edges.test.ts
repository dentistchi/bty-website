import { describe, expect, it } from "vitest";
import { listArenaScenarioOutcomeKeyViolations } from "./arenaScenarioOutcomeKeyViolations";
import { patientComplaintScenario } from "./mockScenario";
import type { ArenaScenario, ResolveOutcome } from "./types";

const minimalOutcome = (partial: Partial<ResolveOutcome> = {}): ResolveOutcome => ({
  interpretation: ["x"],
  activatedStats: ["Insight"],
  systemMessage: "SYS",
  ...partial,
});

describe("listArenaScenarioOutcomeKeyViolations", () => {
  it("accepts patientComplaintScenario (all keys match A/B/C × X/Y)", () => {
    expect(listArenaScenarioOutcomeKeyViolations(patientComplaintScenario)).toEqual([]);
  });

  it("flags keys that are not valid primary_reinforcement mission tokens", () => {
    const scenario: ArenaScenario = {
      ...patientComplaintScenario,
      outcomes: {
        ...patientComplaintScenario.outcomes,
        not_a_key: minimalOutcome(),
      },
    };
    expect(listArenaScenarioOutcomeKeyViolations(scenario)).toEqual([
      "invalid_outcome_key:not_a_key",
    ]);
  });

  it("flags primary token not present on primaryChoices (key parses but id mismatches rows)", () => {
    const scenario: ArenaScenario = {
      id: "scenario-alignment-primary",
      stage: "S",
      caseTag: "T",
      title: "Title",
      difficulty: "Low",
      description: ["one"],
      primaryChoices: [
        { id: "alpha", label: "A", title: "a" },
        { id: "beta", label: "B", title: "b" },
        { id: "gamma", label: "C", title: "c" },
      ],
      reinforcementChoices: [
        { id: "X", label: "X", title: "x" },
        { id: "Y", label: "Y", title: "y" },
      ],
      outcomes: {
        A_X: minimalOutcome(),
      },
    };
    expect(listArenaScenarioOutcomeKeyViolations(scenario)).toEqual(["primary_not_in_scenario:A_X"]);
  });

  it("flags reinforcement token not present on reinforcementChoices", () => {
    const scenario: ArenaScenario = {
      ...patientComplaintScenario,
      reinforcementChoices: [
        {
          id: "X",
          label: "X",
          title: "Only X",
        },
      ],
      outcomes: { ...patientComplaintScenario.outcomes },
    };
    expect(listArenaScenarioOutcomeKeyViolations(scenario)).toEqual([
      "reinforcement_not_in_scenario:A_Y",
      "reinforcement_not_in_scenario:B_Y",
      "reinforcement_not_in_scenario:C_Y",
    ]);
  });

  it("flags both primary and reinforcement ids missing for the same well-formed mission key", () => {
    const scenario: ArenaScenario = {
      id: "scenario-both-mismatch",
      stage: "S",
      caseTag: "T",
      title: "Title",
      difficulty: "Low",
      description: ["one"],
      primaryChoices: [{ id: "p1", label: "A", title: "a" }],
      reinforcementChoices: [{ id: "r1", label: "X", title: "x" }],
      outcomes: {
        A_X: minimalOutcome(),
      },
    };
    expect(listArenaScenarioOutcomeKeyViolations(scenario)).toEqual([
      "primary_not_in_scenario:A_X",
      "reinforcement_not_in_scenario:A_X",
    ]);
  });

  /** S89 TASK16: mixed violation kinds across keys — result sorted lexicographically. */
  it("sorts violations when outcomes mix invalid keys, primary mismatch, and reinforcement mismatch", () => {
    const scenario: ArenaScenario = {
      id: "scenario-mixed-sort",
      stage: "S",
      caseTag: "T",
      title: "Title",
      difficulty: "Low",
      description: ["one"],
      primaryChoices: [{ id: "A", label: "A", title: "a" }],
      reinforcementChoices: [{ id: "X", label: "X", title: "x" }],
      outcomes: {
        totally_bad: minimalOutcome(),
        B_X: minimalOutcome(),
        A_Y: minimalOutcome(),
      },
    };
    expect(listArenaScenarioOutcomeKeyViolations(scenario)).toEqual([
      "invalid_outcome_key:totally_bad",
      "primary_not_in_scenario:B_X",
      "reinforcement_not_in_scenario:A_Y",
    ]);
  });
});
