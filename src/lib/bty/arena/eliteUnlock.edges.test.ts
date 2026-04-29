/**
 * Edge-case tests for eliteUnlock (Arena 8차).
 * TASK 2(weeklyQuest)와 다른 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { canAccessEliteOnlyContent } from "./eliteUnlock";

describe("eliteUnlock (edges)", () => {
  it("all four (isElite, contentEliteOnly) combinations", () => {
    expect(canAccessEliteOnlyContent(true, true)).toBe(true);
    expect(canAccessEliteOnlyContent(true, false)).toBe(true);
    expect(canAccessEliteOnlyContent(false, false)).toBe(true);
    expect(canAccessEliteOnlyContent(false, true)).toBe(false);
  });

  it("contentEliteOnly false always allows access regardless of isElite", () => {
    expect(canAccessEliteOnlyContent(false, false)).toBe(true);
    expect(canAccessEliteOnlyContent(true, false)).toBe(true);
  });

  it("contentEliteOnly true requires isElite", () => {
    expect(canAccessEliteOnlyContent(true, true)).toBe(true);
    expect(canAccessEliteOnlyContent(false, true)).toBe(false);
  });
});
