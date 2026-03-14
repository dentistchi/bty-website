/**
 * Center service re-export hub — 미커버 경계 테스트.
 * resilience·letter·assessment·letterAuth 재export 검증.
 */
import { describe, it, expect } from "vitest";
import * as center from "./index";

describe("lib/bty/center re-export hub", () => {
  it("exports getLetterAuth", () => {
    expect(typeof center.getLetterAuth).toBe("function");
  });

  it("exports getResilienceEntries and parsePeriodDays", () => {
    expect(typeof center.getResilienceEntries).toBe("function");
    expect(typeof center.parsePeriodDays).toBe("function");
  });

  it("exports letter service: submitLetter, submitCenterLetter, getLetterHistory", () => {
    expect(typeof center.submitLetter).toBe("function");
    expect(typeof center.submitCenterLetter).toBe("function");
    expect(typeof center.getLetterHistory).toBe("function");
  });

  it("exports assessment service: submitAssessment, getAssessmentHistory", () => {
    expect(typeof center.submitAssessment).toBe("function");
    expect(typeof center.getAssessmentHistory).toBe("function");
  });
});
