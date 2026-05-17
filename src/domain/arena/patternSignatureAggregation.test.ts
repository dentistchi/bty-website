import { describe, expect, it } from "vitest";
import { applyPatternSignatureTransition } from "@/domain/arena/patternSignatureAggregation";
import type { PatternShiftBand } from "@/domain/leadership-engine/patternShift";

describe("applyPatternSignatureTransition", () => {
  it("first unstable → unstable", () => {
    const n = applyPatternSignatureTransition(null, { validation_result: "unstable" });
    expect(n.current_state).toBe("unstable");
    expect(n.repeat_count_delta).toBe(1);
  });

  it("active with repeat_count≥2 + changed → improving", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "active",
        repeat_count: 2,
        confidence_score: 0.4,
        lifetime_changed_count: 0,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("improving");
  });

  it("improving + changed → resolved", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "improving",
        repeat_count: 3,
        confidence_score: 0.55,
        lifetime_changed_count: 1,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("resolved");
  });

  it("resolved + unstable → unstable", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "resolved",
        repeat_count: 4,
        confidence_score: 0.9,
        lifetime_changed_count: 2,
      },
      { validation_result: "unstable" },
    );
    expect(n.current_state).toBe("unstable");
  });

  it("resolved + changed → improving (re-engagement)", () => {
    const n = applyPatternSignatureTransition(
      {
        current_state: "resolved",
        repeat_count: 4,
        confidence_score: 0.85,
        lifetime_changed_count: 2,
      },
      { validation_result: "changed" },
    );
    expect(n.current_state).toBe("improving");
    expect(n.lifetime_changed_count).toBe(3);
  });

  // --- Route B: insufficient_signal (fallback collapse) must not contaminate ---

  it("insufficient_signal (no prev) → neutral active, base confidence, no evidence", () => {
    const n = applyPatternSignatureTransition(null, {
      validation_result: "unstable",
      result_origin: "insufficient_signal",
    });
    // not "unstable": a non-measurement is not unstable evidence
    expect(n.current_state).toBe("active");
    // base confidence only — no +0.1 first-unstable bump
    expect(n.confidence_score).toBeCloseTo(0.32);
    expect(n.lifetime_changed_count).toBe(0);
  });

  it("insufficient_signal (with prev) → holds aggregate: no confidence/repeat gain", () => {
    const prev = {
      current_state: "improving" as const,
      repeat_count: 3,
      confidence_score: 0.6,
      lifetime_changed_count: 2,
    };
    const n = applyPatternSignatureTransition(prev, {
      validation_result: "unstable",
      result_origin: "insufficient_signal",
    });
    expect(n.current_state).toBe("improving"); // unchanged
    expect(n.repeat_count_delta).toBe(0); // no repeat evidence
    expect(n.confidence_score).toBe(0.6); // no confidence gain
    expect(n.lifetime_changed_count).toBe(2);
  });

  it("computed unstable behaves identically with or without result_origin", () => {
    const prev = {
      current_state: "active" as const,
      repeat_count: 1,
      confidence_score: 0.4,
      lifetime_changed_count: 0,
    };
    const withOrigin = applyPatternSignatureTransition(prev, {
      validation_result: "unstable",
      result_origin: "computed",
    });
    const legacy = applyPatternSignatureTransition(prev, {
      validation_result: "unstable",
    });
    expect(withOrigin).toEqual(legacy); // computed == pre-change baseline
    expect(withOrigin.current_state).toBe("unstable");
    expect(withOrigin.confidence_score).toBeCloseTo(0.52); // 0.4 + 0.12
    expect(withOrigin.repeat_count_delta).toBe(1);
  });

  it("PatternShiftBand remains exactly 3 values (no insufficient_signal band)", () => {
    const all: PatternShiftBand[] = ["changed", "unstable", "no_change"];
    expect(all).toHaveLength(3);
    // @ts-expect-error — "insufficient_signal" must NOT be assignable to PatternShiftBand
    const notABand: PatternShiftBand = "insufficient_signal";
    void notABand;
  });
});
