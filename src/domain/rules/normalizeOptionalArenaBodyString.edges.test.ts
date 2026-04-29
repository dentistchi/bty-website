import { describe, it, expect } from "vitest";
import { normalizeOptionalArenaBodyString } from "./normalizeOptionalArenaBodyString";

describe("normalizeOptionalArenaBodyString (edges)", () => {
  it("returns undefined for null and undefined", () => {
    expect(normalizeOptionalArenaBodyString(null)).toBe(undefined);
    expect(normalizeOptionalArenaBodyString(undefined)).toBe(undefined);
  });

  it("returns undefined for non-string and blank", () => {
    expect(normalizeOptionalArenaBodyString(123)).toBe(undefined);
    expect(normalizeOptionalArenaBodyString("")).toBe(undefined);
    expect(normalizeOptionalArenaBodyString("   ")).toBe(undefined);
  });

  it("returns trimmed string for non-blank input", () => {
    expect(normalizeOptionalArenaBodyString("L1")).toBe("L1");
    expect(normalizeOptionalArenaBodyString("  scenario_1  ")).toBe("scenario_1");
  });
});
