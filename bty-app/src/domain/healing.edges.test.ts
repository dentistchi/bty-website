/**
 * Healing / Awakening domain — Q4 edges (C3-aligned constants).
 */
import { describe, it, expect } from "vitest";
import { AWAKENING_ACT_NAMES, HEALING_PHASE_I_LABEL } from "./healing";

describe("domain/healing (edges)", () => {
  it("AWAKENING_ACT_NAMES has three distinct non-empty labels", () => {
    const labels = Object.values(AWAKENING_ACT_NAMES);
    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(3);
    expect(labels.every((s) => typeof s === "string" && s.length > 0)).toBe(
      true,
    );
  });

  it("HEALING_PHASE_I_LABEL differs from act-1 name (phase vs act copy)", () => {
    expect(HEALING_PHASE_I_LABEL).not.toBe(AWAKENING_ACT_NAMES[1]);
  });
});
