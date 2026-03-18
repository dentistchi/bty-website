/**
 * 성찰 힌트 키 — max·비정상 입력 경계 (SPRINT 50 TASK 8 / 256 C3).
 */
import { describe, it, expect } from "vitest";
import { reflectTextLengthHintKey } from "./reflectTextHint";

describe("reflectTextLengthHintKey edges (256)", () => {
  it("coerces non-positive maxLength to 1 (ratio bands still defined)", () => {
    expect(reflectTextLengthHintKey(0, 0)).toBe("reflect_hint_empty");
    expect(reflectTextLengthHintKey(1, 0)).toBe("reflect_hint_at_limit");
    expect(reflectTextLengthHintKey(0, -10)).toBe("reflect_hint_empty");
  });

  it("exactly 95% of max triggers near_limit band", () => {
    const max = 200;
    const n = 190;
    expect(reflectTextLengthHintKey(n, max)).toBe("reflect_hint_near_limit");
    expect(reflectTextLengthHintKey(189, max)).toBe("reflect_hint_substantial");
  });

  it("fractional maxLength floors to integer cap", () => {
    expect(reflectTextLengthHintKey(50, 99.9)).toBe(reflectTextLengthHintKey(50, 99));
  });
});
