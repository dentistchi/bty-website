import { describe, it, expect } from "vitest";
import { mergeAmount, nodeGatherScale, absorbHi, MERGE_CYCLE_S, WEEKLY_NODE_COUNT } from "./weeklyOrbMerge";

// Sample one full cycle finely.
const PHASES = Array.from({ length: 800 }, (_, i) => (i / 800) * MERGE_CYCLE_S);

describe("weeklyOrbMerge — restored 7 → 1 → 7 cycle (B3A.2D-R3.1)", () => {
  it("represents exactly seven daily nodes (the central form is not an 8th)", () => {
    expect(WEEKLY_NODE_COUNT).toBe(7);
  });

  it("stays fully released (seven distinct) during the rest phase", () => {
    // Rest phase: cyc >= 0.9 → m = 0.
    expect(mergeAmount(0.95 * MERGE_CYCLE_S)).toBe(0);
    expect(nodeGatherScale(mergeAmount(0.95 * MERGE_CYCLE_S))).toBe(1); // nodes at full ring radius
  });

  it("reaches a unified central-light phase (m = 1) during the merge hold", () => {
    const merged = PHASES.filter((t) => mergeAmount(t) === 1);
    expect(merged.length).toBeGreaterThan(0); // a real merge-hold window exists
    // At full merge the nodes have gathered ~90% inward (radii reduced) and absorption is high.
    expect(nodeGatherScale(1)).toBeCloseTo(0.1, 6);
    expect(absorbHi(1)).toBeCloseTo(1, 6);
  });

  it("reduces the node radii monotonically as the merge deepens", () => {
    for (const m of [0, 0.25, 0.5, 0.75, 1]) {
      expect(nodeGatherScale(m)).toBeCloseTo(1 - 0.9 * m, 9);
    }
    expect(nodeGatherScale(1)).toBeLessThan(nodeGatherScale(0)); // gathered < released
  });

  it("re-emerges to seven distinct nodes after the unified phase and repeats each cycle", () => {
    // Across a cycle: some phase is fully released (m≈0), some fully merged (m=1), some partial.
    const values = PHASES.map((t) => mergeAmount(t));
    expect(values.some((m) => m === 0)).toBe(true); // seven distinct
    expect(values.some((m) => m === 1)).toBe(true); // one light
    expect(values.some((m) => m > 0 && m < 1)).toBe(true); // gathering / releasing
    // Continuous repetition: the cycle is periodic with MERGE_CYCLE_S.
    for (const t of [0.1, 1.3, 3.7, 6.9]) {
      expect(mergeAmount(t + MERGE_CYCLE_S)).toBeCloseTo(mergeAmount(t), 9);
      expect(mergeAmount(t + 3 * MERGE_CYCLE_S)).toBeCloseTo(mergeAmount(t), 9);
    }
  });

  it("holds a released frame under reduced motion (no autonomous merge)", () => {
    for (const t of PHASES) expect(mergeAmount(t, true)).toBe(0);
  });
});
