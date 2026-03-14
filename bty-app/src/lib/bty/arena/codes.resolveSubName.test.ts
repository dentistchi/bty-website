/**
 * Unit tests for resolveSubName from Arena codes module.
 * Verifies existing behavior only; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { resolveSubName, SUB_NAMES } from "./codes";

describe("resolveSubName (Arena codes)", () => {
  it("returns custom sub name when non-empty string", () => {
    expect(resolveSubName(0, 0, "Custom")).toBe("Custom");
    expect(resolveSubName(1, 2, "  Trim  ")).toBe("Trim");
    expect(resolveSubName(6, 0, "My Zone")).toBe("My Zone");
  });

  it("returns default for code when custom is null or empty", () => {
    expect(resolveSubName(0, 0, null)).toBe("Spark");
    expect(resolveSubName(0, 0, "")).toBe("Spark");
    expect(resolveSubName(0, 1, null)).toBe("Ember");
    expect(resolveSubName(0, 3, "  ")).toBe("Inferno");
  });

  it("returns default per code index and subTierGroup", () => {
    const codes = [0, 1, 2, 3, 4, 5] as const;
    for (const codeIndex of codes) {
      const names = SUB_NAMES[codeIndex];
      if (!names) continue;
      expect(resolveSubName(codeIndex, 0, null)).toBe(names[0]);
      expect(resolveSubName(codeIndex, 1, null)).toBe(names[1]);
      expect(resolveSubName(codeIndex, 2, null)).toBe(names[2]);
      expect(resolveSubName(codeIndex, 3, null)).toBe(names[3]);
    }
  });

  it("returns em dash for CODELESS ZONE (codeIndex 6) when no custom", () => {
    expect(resolveSubName(6, 0, null)).toBe("—");
    expect(resolveSubName(6, 1, "")).toBe("—");
    expect(resolveSubName(6, 3, null)).toBe("—");
  });

  it("prefers custom over default when both present", () => {
    expect(resolveSubName(0, 0, "Custom")).toBe("Custom");
    expect(resolveSubName(6, 0, "Custom")).toBe("Custom");
  });
});
