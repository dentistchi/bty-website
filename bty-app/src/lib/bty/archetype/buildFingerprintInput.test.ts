import { describe, expect, it } from "vitest";
import type { ArenaSignal } from "@/features/my-page/logic/types";
import type { UserPatternSignaturePublic } from "@/lib/bty/arena/patternSignature.types";
import { buildFingerprintInput } from "./buildFingerprintInput";

/**
 * AL-2-D-P0 — activePatterns Set normalization (R3.5.2 closure).
 *
 * Verifies that aliases resolve through `normalizePatternFamilyId` before
 * `pen()` lookup, while canonical raw inputs preserve pre-AL-2-D-P0 behavior.
 */

const signal: ArenaSignal = {
  scenarioId: "test_scenario",
  primary: "test_primary",
  reinforcement: "test_reinforcement",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traits: { Insight: 0.6, Communication: 0.6, Integrity: 0.6 } as any,
  meta: {
    relationalBias: 0.6,
    operationalBias: 0.6,
    emotionalRegulation: 0.6,
  },
  timestamp: 0,
};

// Produces metrics where AIR=TII=relationalBias=operationalBias=emotionalRegulation=0.6.
// Each axis baseline = 0.6 → with active pen() match, axis = 0.3.

function pattern(pattern_family: string): UserPatternSignaturePublic {
  return {
    pattern_family,
    axis: "test",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current_state: "active" as any,
    repeat_count: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last_validation_result: "neutral" as any,
    confidence_score: 1,
    next_watchpoint: null,
    last_seen_at: "2026-05-09T00:00:00Z",
    first_seen_at: "2026-05-09T00:00:00Z",
  };
}

describe("AL-2-D-P0 — activePatterns alias-aware normalization", () => {
  it("Test 1: canonical raw passthrough — ownership_escape penalty preserved", () => {
    const input = buildFingerprintInput([signal], [pattern("ownership_escape")], 0, 0);
    expect(input.axisVector.ownership).toBeCloseTo(0.3); // 0.6 - 0.3
  });

  it("Test 2: AL-2-B Phase 1 alias — conflict_avoidance triggers conflict penalty (NEW)", () => {
    const input = buildFingerprintInput([signal], [pattern("conflict_avoidance")], 0, 0);
    // pre-AL-2-D-P0: would not resolve, conflict = 0.6 (no penalty)
    // post-AL-2-D-P0: alias resolved to delegation_deflection, conflict = 0.3
    expect(input.axisVector.conflict).toBeCloseTo(0.3);
  });

  it("Test 3: AL-2-C alias — private_intention triggers control penalty (NEW)", () => {
    const input = buildFingerprintInput([signal], [pattern("private_intention")], 0, 0);
    expect(input.axisVector.control).toBeCloseTo(0.3); // resolves to self_protection
  });

  it("Test 4: AL-2-B Phase 2 alias — truth_entry triggers truth penalty (NEW)", () => {
    const input = buildFingerprintInput([signal], [pattern("truth_entry")], 0, 0);
    expect(input.axisVector.truth).toBeCloseTo(0.3); // resolves to truth_naming
  });

  it("Test 5: unknown family passthrough — no penalty applied", () => {
    const input = buildFingerprintInput([signal], [pattern("unknown_family_xyz")], 0, 0);
    expect(input.axisVector.ownership).toBeCloseTo(0.6); // baseline preserved
    expect(input.axisVector.truth).toBeCloseTo(0.6);
    expect(input.axisVector.conflict).toBeCloseTo(0.6);
  });

  it("Test 6: empty patterns — all axes at baseline, no penalty", () => {
    const input = buildFingerprintInput([signal], [], 0, 0);
    expect(input.axisVector.ownership).toBeCloseTo(0.6);
    expect(input.axisVector.time).toBeCloseTo(0.6);
    expect(input.axisVector.repair).toBeCloseTo(0.6);
    expect(input.axisVector.conflict).toBeCloseTo(0.6);
    expect(input.axisVector.accountability).toBeCloseTo(0.6);
    expect(input.axisVector.truth).toBeCloseTo(0.6);
    expect(input.axisVector.integrity).toBeCloseTo(0.6);
    expect(input.axisVector.authority).toBeCloseTo(0.6);
    expect(input.axisVector.visibility).toBeCloseTo(0.6);
    expect(input.axisVector.control).toBeCloseTo(0.6);
  });

  it("Test 7: legacy `explanation` alias — accountability penalty preserved", () => {
    const input = buildFingerprintInput([signal], [pattern("explanation")], 0, 0);
    expect(input.axisVector.accountability).toBeCloseTo(0.3); // resolves via LEGACY_EXPLANATION_ALIAS
  });

  it("Test 8: case-insensitive — 'CONFLICT_AVOIDANCE' resolves identically", () => {
    const input = buildFingerprintInput([signal], [pattern("CONFLICT_AVOIDANCE")], 0, 0);
    expect(input.axisVector.conflict).toBeCloseTo(0.3);
  });

  it("Bonus: patternFamilies field still preserves raw values (Lock 7 carry-forward)", () => {
    // user_pattern_signatures.axis raw flow preservation: patternFamilies in
    // FingerprintInput must NOT be normalized (R3.5.2 confined to activePatterns Set).
    const input = buildFingerprintInput([signal], [pattern("conflict_avoidance")], 0, 0);
    expect(input.patternFamilies).toEqual(["conflict_avoidance"]);
  });
});
