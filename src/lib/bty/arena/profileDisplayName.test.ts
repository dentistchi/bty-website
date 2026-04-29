import { describe, it, expect } from "vitest";
import { validateDisplayName, DISPLAY_NAME_MAX_LENGTH } from "./profileDisplayName";

describe("profileDisplayName", () => {
  it("accepts null and undefined as valid (sanitized null)", () => {
    expect(validateDisplayName(null)).toEqual({ valid: true, sanitized: null });
    expect(validateDisplayName(undefined)).toEqual({ valid: true, sanitized: null });
  });

  it("accepts empty string as valid (sanitized null)", () => {
    expect(validateDisplayName("")).toEqual({ valid: true, sanitized: null });
    expect(validateDisplayName("   ")).toEqual({ valid: true, sanitized: null });
  });

  it("returns trimmed string when within max length", () => {
    expect(validateDisplayName("  Alice  ")).toEqual({ valid: true, sanitized: "Alice" });
    const maxLen = "x".repeat(DISPLAY_NAME_MAX_LENGTH);
    expect(validateDisplayName(maxLen)).toEqual({ valid: true, sanitized: maxLen });
  });

  it("rejects over max length with DISPLAY_NAME_TOO_LONG", () => {
    const over = "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
    const r = validateDisplayName(over);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("DISPLAY_NAME_TOO_LONG");
    expect(r.sanitized).toBeNull();
  });

  it("DISPLAY_NAME_MAX_LENGTH is 64", () => {
    expect(DISPLAY_NAME_MAX_LENGTH).toBe(64);
  });
});
