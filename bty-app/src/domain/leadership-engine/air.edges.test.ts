/**
 * AIR 도메인 경계 테스트.
 * air.test.ts와 중복 없이 미커버 경계만.
 */
import { describe, it, expect } from "vitest";
import {
  computeAIR,
  computeAIRSnapshot,
  airToBand,
  WEIGHT_MICRO_WIN,
  WEIGHT_RESET,
  CONSECUTIVE_MISS_THRESHOLD,
  type ActivationRecord,
  type AIRResult,
} from "./air";

const NOW = new Date("2026-03-10T00:00:00Z");
const DAY = 86_400_000;
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function makeActivation(overrides: Partial<ActivationRecord> & { type: ActivationRecord["type"] }): ActivationRecord {
  return {
    activation_id: "a1",
    user_id: "u1",
    chosen_at: daysAgo(5),
    due_at: daysAgo(3),
    completed_at: daysAgo(4),
    verified: true,
    ...overrides,
  };
}

describe("air (edges)", () => {
  it("constants are stable for re-export", () => {
    expect(WEIGHT_MICRO_WIN).toBe(1);
    expect(WEIGHT_RESET).toBe(2);
    expect(CONSECUTIVE_MISS_THRESHOLD).toBe(3);
  });

  it("computeAIR empty activations returns AIRResult with zeros", () => {
    const r: AIRResult = computeAIR([], "14d", NOW);
    expect(r.air).toBe(0);
    expect(r.missedWindows).toBe(0);
    expect(r.integritySlip).toBe(false);
  });

  it("computeAIRSnapshot empty activations returns all periods with zeros", () => {
    const snapshot = computeAIRSnapshot([], NOW);
    expect(snapshot.air_7d.air).toBe(0);
    expect(snapshot.air_14d.air).toBe(0);
    expect(snapshot.air_90d.air).toBe(0);
    expect(snapshot.air_7d.integritySlip).toBe(false);
  });

  it("computeAIR single completed micro_win in window", () => {
    const activations = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const r = computeAIR(activations, "7d", NOW);
    expect(r.air).toBe(1);
    expect(r.missedWindows).toBe(0);
  });

  it("computeAIR single completed reset in window uses weight 2", () => {
    const activations = [
      makeActivation({ type: "reset", chosen_at: daysAgo(5), due_at: daysAgo(2), completed_at: daysAgo(3), verified: true }),
    ];
    const r = computeAIR(activations, "7d", NOW);
    expect(r.air).toBe(1);
    expect(r.missedWindows).toBe(0);
  });

  it("computeAIR period 90d with single completed activation in window", () => {
    const activations = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(30), due_at: daysAgo(28), completed_at: daysAgo(29), verified: true }),
    ];
    const r = computeAIR(activations, "90d", NOW);
    expect(r.air).toBe(1);
    expect(r.missedWindows).toBe(0);
  });

  it("computeAIR period 14d with single completed activation in window yields air 1", () => {
    const activations = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(2), completed_at: daysAgo(3), verified: true }),
    ];
    const r = computeAIR(activations, "14d", NOW);
    expect(r.air).toBe(1);
    expect(r.missedWindows).toBe(0);
  });

  it("computeAIR single missed activation in window returns air 0 (penalty floor)", () => {
    const activations = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: null, verified: false }),
    ];
    const r = computeAIR(activations, "7d", NOW);
    expect(r.missedWindows).toBe(1);
    expect(r.air).toBe(0);
  });

  it("computeAIRSnapshot with one completed activation yields non-zero air_7d", () => {
    const activations = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(2), due_at: daysAgo(1), completed_at: daysAgo(1), verified: true }),
    ];
    const snapshot = computeAIRSnapshot(activations, NOW);
    expect(snapshot.air_7d.air).toBeGreaterThan(0);
    expect(snapshot.air_7d.integritySlip).toBe(false);
  });

  describe("airToBand", () => {
    it("returns low for air < 0.5 (LOCKED v2)", () => {
      expect(airToBand(0)).toBe("low");
      expect(airToBand(0.49)).toBe("low");
    });
    it("returns mid for 0.5 <= air < 0.8", () => {
      expect(airToBand(0.5)).toBe("mid");
      expect(airToBand(0.65)).toBe("mid");
      expect(airToBand(0.79)).toBe("mid");
    });
    it("returns high for air >= 0.8", () => {
      expect(airToBand(0.8)).toBe("high");
      expect(airToBand(1)).toBe("high");
    });
  });
});
