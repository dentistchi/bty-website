/**
 * domain/dojo/integrity/types — Center/Foundry 미커버 경계 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  INTEGRITY_MAX_TEXT_LENGTH,
  type IntegrityScenario,
  type IntegritySubmission,
  type IntegritySubmitPayload,
} from "./types";

describe("dojo/integrity types", () => {
  it("INTEGRITY_MAX_TEXT_LENGTH is 5000", () => {
    expect(INTEGRITY_MAX_TEXT_LENGTH).toBe(5_000);
  });

  it("IntegritySubmitPayload allows text and choiceId optional", () => {
    const a: IntegritySubmitPayload = {};
    const b: IntegritySubmitPayload = { text: "x" };
    const c: IntegritySubmitPayload = { choiceId: "A" };
    const d: IntegritySubmitPayload = { text: "x", choiceId: "A" };
    expect(a).toBeDefined();
    expect(b.text).toBe("x");
    expect(c.choiceId).toBe("A");
    expect(d.text).toBe("x");
    expect(d.choiceId).toBe("A");
  });

  it("IntegrityScenario has required shape", () => {
    const s: IntegrityScenario = {
      id: "scn-1",
      situationKo: "상황",
      situationEn: "Situation",
      choices: [{ id: "A", labelKo: "선택", labelEn: "Choice" }],
    };
    expect(s.id).toBe("scn-1");
    expect(s.choices).toHaveLength(1);
  });

  it("IntegritySubmission has required shape", () => {
    const sub: IntegritySubmission = {
      userId: "u1",
      scenarioId: "s1",
      createdAt: "2026-03-10T00:00:00Z",
    };
    expect(sub.userId).toBe("u1");
    expect(sub.scenarioId).toBe("s1");
  });
});
