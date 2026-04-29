/**
 * domain/dojo/integrity/types — 경계 테스트.
 * types.test.ts와 중복 없이 상수·타입 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  INTEGRITY_MAX_TEXT_LENGTH,
  type IntegritySubmitPayload,
  type IntegrityScenario,
  type IntegritySubmission,
} from "./types";

describe("dojo/integrity types (edges)", () => {
  it("INTEGRITY_MAX_TEXT_LENGTH is stable and numeric", () => {
    expect(INTEGRITY_MAX_TEXT_LENGTH).toBe(5_000);
    expect(Number.isInteger(INTEGRITY_MAX_TEXT_LENGTH)).toBe(true);
  });

  it("IntegritySubmitPayload allows null text and choiceId", () => {
    const p: IntegritySubmitPayload = { text: null, choiceId: null };
    expect(p.text).toBeNull();
    expect(p.choiceId).toBeNull();
  });

  it("IntegrityScenario choices array can be empty", () => {
    const s: IntegrityScenario = {
      id: "e1",
      situationKo: "상황",
      situationEn: "Situation",
      choices: [],
    };
    expect(s.choices).toHaveLength(0);
  });

  it("IntegrityScenario situationKo and situationEn can be empty strings", () => {
    const s: IntegrityScenario = {
      id: "e2",
      situationKo: "",
      situationEn: "",
      choices: [{ id: "c1", labelKo: "선택", labelEn: "Choice" }],
    };
    expect(s.situationKo).toBe("");
    expect(s.situationEn).toBe("");
  });

  it("IntegritySubmission allows optional text and choiceId omitted", () => {
    const sub: IntegritySubmission = {
      userId: "u1",
      scenarioId: "s1",
      createdAt: "2026-03-01T00:00:00Z",
    };
    expect(sub.userId).toBe("u1");
    expect(sub.scenarioId).toBe("s1");
    expect("text" in sub ? sub.text : undefined).toBeUndefined();
  });
});
