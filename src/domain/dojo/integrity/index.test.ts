/**
 * domain/dojo/integrity/index — re-export 경계 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  INTEGRITY_MAX_TEXT_LENGTH,
  validateIntegrityResponse,
  type IntegrityScenario,
  type IntegritySubmission,
  type IntegritySubmitPayload,
  type ValidateIntegrityResult,
} from "./index";

describe("domain/dojo/integrity/index", () => {
  it("re-exports INTEGRITY_MAX_TEXT_LENGTH", () => {
    expect(INTEGRITY_MAX_TEXT_LENGTH).toBe(5_000);
  });

  it("re-exports validateIntegrityResponse", () => {
    expect(validateIntegrityResponse("ok", null)).toEqual({ ok: true });
    expect(validateIntegrityResponse(null, "choice-1")).toEqual({ ok: true });
    expect(validateIntegrityResponse(null, null)).toEqual({ ok: false, error: "missing_input" });
  });

  it("re-exports types for type-only usage", () => {
    const s: IntegrityScenario = {
      id: "s1",
      situationKo: "상황",
      situationEn: "Situation",
      choices: [{ id: "c1", labelKo: "선택", labelEn: "Choice" }],
    };
    expect(s.id).toBe("s1");

    const sub: IntegritySubmission = {
      userId: "u1",
      scenarioId: "s1",
      createdAt: "2026-03-10T00:00:00Z",
    };
    expect(sub.userId).toBe("u1");

    const payload: IntegritySubmitPayload = { text: "답변" };
    expect(payload.text).toBe("답변");

    const result: ValidateIntegrityResult = { ok: true };
    expect(result.ok).toBe(true);
  });
});
