/**
 * reflectTextBounds — 상수·힌트 구간과의 정합 (SPRINT 56 TASK 8 / C3).
 */
import { describe, it, expect } from "vitest";
import {
  REFLECT_USER_TEXT_MAX_CHARS,
  REFLECT_USER_TEXT_MIN_CHARS,
  REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS,
  clampArenaReflectUserTextToMax,
} from "./reflectTextBounds";
import { reflectTextLengthHintKey } from "./reflectTextHint";

describe("reflectTextBounds (edges)", () => {
  it("max >= recommended >= min and min is positive", () => {
    expect(REFLECT_USER_TEXT_MAX_CHARS).toBeGreaterThanOrEqual(
      REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS
    );
    expect(REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS).toBeGreaterThanOrEqual(
      REFLECT_USER_TEXT_MIN_CHARS
    );
    expect(REFLECT_USER_TEXT_MIN_CHARS).toBe(1);
  });

  it("recommended min aligns with developing band lower bound (15% of max)", () => {
    const fifteenPercent = Math.floor(REFLECT_USER_TEXT_MAX_CHARS * 0.15);
    expect(REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS).toBe(fifteenPercent);
  });

  it("at recommended min, hint is developing (not short)", () => {
    expect(
      reflectTextLengthHintKey(
        REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS,
        REFLECT_USER_TEXT_MAX_CHARS
      )
    ).toBe("reflect_hint_developing");
  });

  it("one below recommended min stays in short band when max is large", () => {
    const n = REFLECT_USER_TEXT_RECOMMENDED_MIN_CHARS - 1;
    expect(
      reflectTextLengthHintKey(n, REFLECT_USER_TEXT_MAX_CHARS)
    ).toBe("reflect_hint_short");
  });

  it("zero chars maps to empty hint", () => {
    expect(
      reflectTextLengthHintKey(0, REFLECT_USER_TEXT_MAX_CHARS)
    ).toBe("reflect_hint_empty");
  });

  it("clampArenaReflectUserTextToMax truncates at max chars", () => {
    const short = "hello";
    expect(clampArenaReflectUserTextToMax(short)).toBe(short);
    const atMax = "x".repeat(REFLECT_USER_TEXT_MAX_CHARS);
    expect(clampArenaReflectUserTextToMax(atMax)).toBe(atMax);
    const over = "x".repeat(REFLECT_USER_TEXT_MAX_CHARS + 100);
    expect(clampArenaReflectUserTextToMax(over).length).toBe(REFLECT_USER_TEXT_MAX_CHARS);
  });
});
