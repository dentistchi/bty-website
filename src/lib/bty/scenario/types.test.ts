/**
 * scenario/types — Arena 시나리오 타입 shape 검증 (비즈니스/XP 미변경).
 */
import { describe, it, expect } from "vitest";
import type {
  HiddenStatKey,
  ScenarioChoice,
  ScenarioCoachNotes,
  Scenario,
  ScenarioSubmitPayload,
  ScenarioSubmitResult,
} from "./types";

describe("scenario/types", () => {
  it("HiddenStatKey is one of integrity, communication, insight, resilience, gratitude", () => {
    const keys: HiddenStatKey[] = ["integrity", "communication", "insight", "resilience", "gratitude"];
    expect(keys).toHaveLength(5);
    expect(keys).toContain("integrity");
    expect(keys).toContain("resilience");
  });

  it("ScenarioChoice has required keys", () => {
    const choice: ScenarioChoice = {
      choiceId: "A",
      label: "Option A",
      intent: "clarify",
      xpBase: 10,
      difficulty: 1,
      hiddenDelta: {},
      result: "Done.",
      microInsight: "You reflected.",
    };
    expect(choice.choiceId).toBe("A");
    expect(choice.xpBase).toBe(10);
    expect(Object.keys(choice).sort()).toContain("choiceId");
    expect(Object.keys(choice).sort()).toContain("hiddenDelta");
  });

  it("ScenarioCoachNotes has whatThisTrains and whyItMatters", () => {
    const notes: ScenarioCoachNotes = {
      whatThisTrains: ["communication"],
      whyItMatters: "Builds clarity.",
    };
    expect(notes.whatThisTrains).toEqual(["communication"]);
    expect(notes.whyItMatters).toBeDefined();
  });

  it("Scenario has scenarioId, title, context, choices", () => {
    const scenario: Scenario = {
      scenarioId: "s1",
      title: "Test",
      context: "Context.",
      choices: [],
    };
    expect(scenario.scenarioId).toBe("s1");
    expect(scenario.choices).toEqual([]);
    expect(Object.keys(scenario)).toContain("title");
  });

  it("ScenarioSubmitPayload has scenarioId, choiceId, optional locale", () => {
    const payload: ScenarioSubmitPayload = {
      scenarioId: "s1",
      choiceId: "B",
    };
    expect(payload.scenarioId).toBe("s1");
    expect(payload.choiceId).toBe("B");
    const withLocale: ScenarioSubmitPayload = { ...payload, locale: "ko" };
    expect(withLocale.locale).toBe("ko");
  });

  it("ScenarioSubmitResult has ok, scenarioId, choiceId, xpEarned, hiddenDelta, microInsight, result", () => {
    const result: ScenarioSubmitResult = {
      ok: true,
      scenarioId: "s1",
      choiceId: "C",
      xpEarned: 5,
      hiddenDelta: { integrity: 1 },
      microInsight: "Insight.",
      result: "Result text.",
    };
    expect(result.ok).toBe(true);
    expect(result.xpEarned).toBe(5);
    expect(result.hiddenDelta).toEqual({ integrity: 1 });
  });
});
