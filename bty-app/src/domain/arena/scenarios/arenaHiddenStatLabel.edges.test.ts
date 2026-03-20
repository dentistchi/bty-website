import { describe, it, expect } from "vitest";
import { isArenaHiddenStatLabel } from "./arenaHiddenStatLabel";

describe("isArenaHiddenStatLabel (edges)", () => {
  it("returns true for all five canonical labels", () => {
    expect(isArenaHiddenStatLabel("Integrity")).toBe(true);
    expect(isArenaHiddenStatLabel("Communication")).toBe(true);
    expect(isArenaHiddenStatLabel("Insight")).toBe(true);
    expect(isArenaHiddenStatLabel("Resilience")).toBe(true);
    expect(isArenaHiddenStatLabel("Gratitude")).toBe(true);
  });

  it("returns false for wrong casing, typos, or unknown strings", () => {
    expect(isArenaHiddenStatLabel("integrity")).toBe(false);
    expect(isArenaHiddenStatLabel("INTEGRITY")).toBe(false);
    expect(isArenaHiddenStatLabel("Intregrity")).toBe(false);
    expect(isArenaHiddenStatLabel("Honor")).toBe(false);
    expect(isArenaHiddenStatLabel("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isArenaHiddenStatLabel(null)).toBe(false);
    expect(isArenaHiddenStatLabel(undefined)).toBe(false);
    expect(isArenaHiddenStatLabel(1)).toBe(false);
    expect(isArenaHiddenStatLabel(["Integrity"])).toBe(false);
  });
});
