import { describe, it, expect } from "vitest";
import { isLegacyScenarioDbBody, rejectLegacyScenarioPayload } from "./scenarioPayloadFromDb";
import type { Scenario } from "@/lib/bty/scenario/types";

describe("isLegacyScenarioDbBody", () => {
  it("flags legacy beginner JSON", () => {
    expect(
      isLegacyScenarioDbBody(
        '{"kind":"beginner_7step","title":"x","context":"y","emotionOptions":[]}',
      ),
    ).toBe(true);
  });

  it("allows plain scenario body text", () => {
    expect(isLegacyScenarioDbBody("A patient declines treatment after hearing the cost.")).toBe(false);
  });

  it("flags legacy markers integrityTrigger and decisionOptions", () => {
    expect(isLegacyScenarioDbBody('{"integrityTrigger":true}')).toBe(true);
    expect(isLegacyScenarioDbBody('{"decisionOptions":[]}')).toBe(true);
  });
});

describe("rejectLegacyScenarioPayload", () => {
  it("rejects scenario-shaped object containing legacy substring in labels", () => {
    const bad: Scenario = {
      scenarioId: "x",
      title: "t",
      context: "c",
      choices: [
        {
          choiceId: "A",
          label: 'Contains emotionOptions in text',
          intent: "i",
          xpBase: 10,
          difficulty: 1,
          hiddenDelta: {},
          result: "r",
          microInsight: "m",
        },
      ],
    };
    expect(rejectLegacyScenarioPayload(bad)).toBe(true);
  });
});
