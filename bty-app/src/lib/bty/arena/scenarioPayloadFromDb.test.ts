import { describe, it, expect } from "vitest";
import {
  isLegacyScenarioDbBody,
  loadArenaScenarioPayloadFromDb,
  rejectLegacyScenarioPayload,
} from "./scenarioPayloadFromDb";
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

describe("loadArenaScenarioPayloadFromDb canonical source", () => {
  it("loads core_01 from src/data/scenario canonical registry", async () => {
    const scenario = await loadArenaScenarioPayloadFromDb(
      null,
      "core_01_training_system_exposure",
      "en",
    );
    expect(scenario).not.toBeNull();
    expect(scenario?.title).toBe("Performance Issue or Early System Signal");
    expect(scenario?.title).not.toBe("Write Them Up or Name the System");
    expect(scenario?.dbScenarioId).toBe("INCIDENT-01-OWN-01");
  });

  it("inlines stage_2_escalation into tradeoff second_choices protects/risks for core_07", async () => {
    const scenario = await loadArenaScenarioPayloadFromDb(null, "core_07_repair_conversation", "en");
    expect(scenario).not.toBeNull();
    const branch = scenario?.escalationBranches?.A;
    const x = branch?.second_choices?.find((c) => c.id === "X");
    expect(x?.cost?.trim().length).toBeGreaterThan(0);
    expect(x?.protects).toBe("Conversation becomes safer but loses definition");
    expect(x?.risks).toBe("Everyone leaves with their own version");
    expect(branch && "stage_2_escalation" in branch ? (branch as { stage_2_escalation?: unknown }).stage_2_escalation : undefined).toBeUndefined();
  });
});
