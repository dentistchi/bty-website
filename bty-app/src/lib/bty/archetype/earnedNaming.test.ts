import { describe, it, expect } from "vitest";
import {
  isEarnedNamingEligible,
  buildPatternFormingResolution,
  ENTRY_THRESHOLD,
  EXIT_THRESHOLD,
} from "./earnedNaming";

describe("isEarnedNamingEligible", () => {
  // 3.1 — ENTRY: both dimensions met
  it("eligible when scenariosCompleted=12 and contractsCompleted=3 (no existing lock)", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 12, contractsCompleted: 3 }, false);
    expect(r.eligible).toBe(true);
    expect(r.threshold).toBe(ENTRY_THRESHOLD);
    expect(r.missingDimensions).toHaveLength(0);
  });

  // 3.2 — ENTRY: scenarios short
  it("not eligible when scenariosCompleted=11 (below entry threshold 12)", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 11, contractsCompleted: 3 }, false);
    expect(r.eligible).toBe(false);
    expect(r.missingDimensions).toContain("scenariosCompleted");
    expect(r.missingDimensions).not.toContain("contractsCompleted");
  });

  // 3.3 — ENTRY: contracts short
  it("not eligible when contractsCompleted=2 (below entry threshold 3)", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 12, contractsCompleted: 2 }, false);
    expect(r.eligible).toBe(false);
    expect(r.missingDimensions).toContain("contractsCompleted");
    expect(r.missingDimensions).not.toContain("scenariosCompleted");
  });

  // 3.4 — EXIT (hysteresis): meets exit threshold, has existing lock
  it("eligible at exit threshold (9/2) with existing lock", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 9, contractsCompleted: 2 }, true);
    expect(r.eligible).toBe(true);
    expect(r.threshold).toBe(EXIT_THRESHOLD);
  });

  // 3.5 — EXIT oscillation guard: exactly at exit boundary
  it("eligible at exit boundary (8/2) with existing lock", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 8, contractsCompleted: 2 }, true);
    expect(r.eligible).toBe(true);
  });

  it("not eligible just below exit boundary (7/2) with existing lock", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 7, contractsCompleted: 2 }, true);
    expect(r.eligible).toBe(false);
    expect(r.missingDimensions).toContain("scenariosCompleted");
  });

  // 3.6 — Hysteresis: same evidence, different eligibility based on lock state
  it("same evidence (8/2) eligible with lock, not eligible without lock", () => {
    const withLock = isEarnedNamingEligible({ scenariosCompleted: 8, contractsCompleted: 2 }, true);
    const withoutLock = isEarnedNamingEligible({ scenariosCompleted: 8, contractsCompleted: 2 }, false);
    expect(withLock.eligible).toBe(true);
    expect(withoutLock.eligible).toBe(false);
    expect(withLock.threshold).toBe(EXIT_THRESHOLD);
    expect(withoutLock.threshold).toBe(ENTRY_THRESHOLD);
  });

  it("both missing dimensions reported", () => {
    const r = isEarnedNamingEligible({ scenariosCompleted: 0, contractsCompleted: 0 }, false);
    expect(r.eligible).toBe(false);
    expect(r.missingDimensions).toContain("scenariosCompleted");
    expect(r.missingDimensions).toContain("contractsCompleted");
  });
});

// 3.7 — PatternFormingResolution forbidden field check
describe("buildPatternFormingResolution", () => {
  it("returns status=pattern_forming with progress and threshold", () => {
    const r = buildPatternFormingResolution({ scenariosCompleted: 5, contractsCompleted: 1 }, false);
    expect(r.status).toBe("pattern_forming");
    expect(r.progress.scenariosCompleted).toBe(5);
    expect(r.progress.contractsCompleted).toBe(1);
    expect(r.threshold).toBe(ENTRY_THRESHOLD);
  });

  it("does not expose archetype fields (lockId, inputHash, etc.)", () => {
    const r = buildPatternFormingResolution({ scenariosCompleted: 5, contractsCompleted: 1 }, false);
    expect(r).not.toHaveProperty("lockId");
    expect(r).not.toHaveProperty("inputHash");
    expect(r).not.toHaveProperty("archetypeName");
    expect(r).not.toHaveProperty("selectedBy");
    expect(r).not.toHaveProperty("candidatePool");
  });
});
