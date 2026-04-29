/**
 * C6 244 — Core/Weekly 분리(주간 경계)·Dojo 질문 세트 지문 핑거프린트 엣지.
 */
import { describe, it, expect } from "vitest";
import { ledgerStateAfterWeeklyBoundaryReset } from "./weeklyResetIdempotency";

function dojoQuestionSetFingerprint(questionIds: readonly string[]): string {
  return [...questionIds].sort().join("\n");
}

describe("244 core/weekly + dojo fingerprint", () => {
  it("weekly boundary advance: new week → weekly bucket 0 (Core XP 별도 저장 불변식과 정합)", () => {
    const o = ledgerStateAfterWeeklyBoundaryReset({
      storedWeekId: "2026-03-03",
      activeWeekId: "2026-03-10",
      storedXpTotal: 999,
    });
    expect(o.kind).toBe("advance_week_zero_xp");
    if (o.kind === "advance_week_zero_xp") {
      expect(o.xpTotal).toBe(0);
      expect(o.weekId).toBe("2026-03-10");
    }
  });

  it("dojo question set fingerprint stable under id reorder", () => {
    expect(dojoQuestionSetFingerprint(["c", "a", "b"])).toBe("a\nb\nc");
    expect(dojoQuestionSetFingerprint(["a", "b"])).toBe(dojoQuestionSetFingerprint(["b", "a"]));
  });
});
