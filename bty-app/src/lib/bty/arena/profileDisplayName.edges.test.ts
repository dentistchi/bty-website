/**
 * Edge-case tests for profileDisplayName (Arena 4차).
 * TASK 3(mentorRequest)과 다른 모듈. 기존 동작만 검증, 비즈니스/XP 로직 미변경.
 */
import { describe, it, expect } from "vitest";
import { validateDisplayName, DISPLAY_NAME_MAX_LENGTH } from "./profileDisplayName";

describe("profileDisplayName (edges)", () => {
  it("accepts exactly DISPLAY_NAME_MAX_LENGTH chars", () => {
    const exact = "a".repeat(DISPLAY_NAME_MAX_LENGTH);
    const r = validateDisplayName(exact);
    expect(r.valid).toBe(true);
    expect(r.sanitized).toBe(exact);
  });

  it("rejects DISPLAY_NAME_MAX_LENGTH + 1 chars", () => {
    const over = "b".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
    const r = validateDisplayName(over);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("DISPLAY_NAME_TOO_LONG");
    expect(r.sanitized).toBeNull();
  });

  it("trimmed length at boundary: leading/trailing spaces not counted", () => {
    const inner = "c".repeat(DISPLAY_NAME_MAX_LENGTH);
    const withSpaces = `  ${inner}  `;
    const r = validateDisplayName(withSpaces);
    expect(r.valid).toBe(true);
    expect(r.sanitized).toBe(inner);
  });

  it("whitespace-only string returns valid true and sanitized null", () => {
    const r = validateDisplayName("   \t\n  ");
    expect(r.valid).toBe(true);
    expect(r.sanitized).toBeNull();
  });
});
