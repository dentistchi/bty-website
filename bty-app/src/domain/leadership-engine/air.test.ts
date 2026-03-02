import { describe, it, expect } from "vitest";
import {
  computeAIR,
  computeAIRSnapshot,
  detectIntegritySlip,
  hasThreeConsecutiveNonExecutionWarning,
  WEIGHT_MICRO_WIN,
  WEIGHT_RESET,
  MISSED_WINDOW_PENALTY,
  type ActivationRecord,
  type AIRLedger,
} from "./air";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-01T00:00:00Z");
const DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function makeActivation(
  overrides: Partial<ActivationRecord> & { type: ActivationRecord["type"] },
): ActivationRecord {
  return {
    activation_id: Math.random().toString(36).slice(2),
    user_id: "u1",
    chosen_at: daysAgo(3),
    due_at: daysAgo(1),
    completed_at: daysAgo(2),
    verified: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Normal — completed activations, no penalties
// ---------------------------------------------------------------------------

describe("computeAIR — normal cases", () => {
  it("returns 0 when no activations in window", () => {
    const result = computeAIR([], "7d", NOW);
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(0);
    expect(result.integritySlip).toBe(false);
  });

  it("returns 1.0 when all micro_win activations are completed+verified", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: daysAgo(4), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(2), completed_at: daysAgo(3), verified: true }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(1.0);
    expect(result.missedWindows).toBe(0);
    expect(result.integritySlip).toBe(false);
  });

  it("returns 1.0 when all reset activations are completed+verified", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "reset", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: daysAgo(4), verified: true }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(1.0);
  });

  it("applies correct weights: 1 reset (w=2) completed + 1 micro_win (w=1) completed = 1.0", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "reset", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: daysAgo(4), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: daysAgo(4), verified: true }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(1.0);
  });

  it("weights reset=2x and micro_win=1x correctly for partial completion", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "reset", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: daysAgo(4), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    // weighted completed = 2, weighted chosen = 3, raw = 2/3
    // 1 missed window → penalty -0.10 → 2/3 - 0.10 ≈ 0.567
    const expected = WEIGHT_RESET / (WEIGHT_RESET + WEIGHT_MICRO_WIN) - MISSED_WINDOW_PENALTY;
    expect(result.air).toBeCloseTo(expected, 5);
    expect(result.missedWindows).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Penalty — missed windows
// ---------------------------------------------------------------------------

describe("computeAIR — missed window penalties", () => {
  it("applies -0.10 per missed window", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(6), due_at: daysAgo(4), completed_at: daysAgo(5), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(2), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    // raw = 1/3, 2 missed → penalty = 0.20 → 1/3 - 0.20 ≈ 0.133
    const raw = WEIGHT_MICRO_WIN / (3 * WEIGHT_MICRO_WIN);
    const expected = Math.max(0, raw - 2 * MISSED_WINDOW_PENALTY);
    expect(result.air).toBeCloseTo(expected, 5);
    expect(result.missedWindows).toBe(2);
  });

  it("floors AIR at 0 when penalties exceed raw", () => {
    const activations: ActivationRecord[] = Array.from({ length: 5 }, (_, i) =>
      makeActivation({
        type: "micro_win",
        chosen_at: daysAgo(6 - i),
        due_at: daysAgo(4 - i > 0 ? 4 - i : 1),
        completed_at: null,
        verified: false,
      }),
    );
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(5);
  });

  it("does not count not-yet-due activations as missed", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(2), due_at: new Date(NOW.getTime() + DAY), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.missedWindows).toBe(0);
    expect(result.air).toBe(0);
  });

  it("does not count completed-but-unverified as completed", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    // completed_at is set so not "missed", but verified=false so not "completed" → raw = 0/1 = 0
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Integrity slip (3 consecutive missed)
// ---------------------------------------------------------------------------

describe("detectIntegritySlip", () => {
  it("returns false for 2 consecutive misses", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(4), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(3), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(2), completed_at: daysAgo(2), verified: true }),
    ];
    expect(detectIntegritySlip(activations, NOW)).toBe(false);
  });

  it("returns true for 3 consecutive misses", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(6), due_at: daysAgo(5), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(4), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(3), completed_at: null, verified: false }),
    ];
    expect(detectIntegritySlip(activations, NOW)).toBe(true);
  });

  it("resets consecutive count when a completed activation breaks the streak", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(6), due_at: daysAgo(5), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(4), completed_at: null, verified: false }),
      makeActivation({ type: "reset",    chosen_at: daysAgo(4), due_at: daysAgo(3), completed_at: daysAgo(3), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(2), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(2), due_at: daysAgo(1), completed_at: null, verified: false }),
    ];
    expect(detectIntegritySlip(activations, NOW)).toBe(false);
  });

  it("triggers integrity_slip when 3rd miss follows mixed types", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "reset",    chosen_at: daysAgo(6), due_at: daysAgo(5), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(4), completed_at: null, verified: false }),
      makeActivation({ type: "reset",    chosen_at: daysAgo(4), due_at: daysAgo(3), completed_at: null, verified: false }),
    ];
    expect(detectIntegritySlip(activations, NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Rolling window filtering
// ---------------------------------------------------------------------------

describe("computeAIR — window filtering", () => {
  it("7d window excludes activations older than 7 days", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(10), due_at: daysAgo(8), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(1.0);
    expect(result.missedWindows).toBe(0);
  });

  it("14d window includes activations within 14 days", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(10), due_at: daysAgo(8), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const result = computeAIR(activations, "14d", NOW);
    // 2 in window: 1 completed (w=1), 1 missed (w=1). raw = 0.5, -0.10 = 0.40
    expect(result.air).toBeCloseTo(0.4, 5);
    expect(result.missedWindows).toBe(1);
  });

  it("90d window captures long-range activations", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(85), due_at: daysAgo(83), completed_at: daysAgo(84), verified: true }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const result = computeAIR(activations, "90d", NOW);
    expect(result.air).toBe(1.0);
  });

  it("excludes activations chosen exactly at window boundary", () => {
    const boundary = new Date(NOW.getTime() - 7 * DAY - 1);
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: boundary, due_at: daysAgo(5), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. computeAIRSnapshot — all three windows
// ---------------------------------------------------------------------------

describe("computeAIRSnapshot", () => {
  it("returns all three window results", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const snap = computeAIRSnapshot(activations, NOW);
    expect(snap.air_7d.air).toBe(1.0);
    expect(snap.air_14d.air).toBe(1.0);
    expect(snap.air_90d.air).toBe(1.0);
  });

  it("windows diverge when older activations are missed", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(10), due_at: daysAgo(8), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(3), due_at: daysAgo(1), completed_at: daysAgo(2), verified: true }),
    ];
    const snap = computeAIRSnapshot(activations, NOW);
    expect(snap.air_7d.air).toBe(1.0);
    expect(snap.air_14d.air).toBeCloseTo(0.4, 5);
    expect(snap.air_90d.air).toBeCloseTo(0.4, 5);
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases
// ---------------------------------------------------------------------------

describe("computeAIR — edge cases", () => {
  it("AIR is 0 when all activations are missed", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(3), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(2), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(2);
  });

  it("single reset completed = 1.0", () => {
    const result = computeAIR(
      [makeActivation({ type: "reset", chosen_at: daysAgo(2), due_at: daysAgo(1), completed_at: daysAgo(1), verified: true })],
      "7d",
      NOW,
    );
    expect(result.air).toBe(1.0);
  });

  it("activations chosen in the future are excluded", () => {
    const future = new Date(NOW.getTime() + DAY);
    const result = computeAIR(
      [makeActivation({ type: "micro_win", chosen_at: future, due_at: future, completed_at: null, verified: false })],
      "7d",
      NOW,
    );
    expect(result.air).toBe(0);
    expect(result.missedWindows).toBe(0);
  });

  it("integrity_slip propagates into AIRResult", () => {
    const activations: ActivationRecord[] = [
      makeActivation({ type: "micro_win", chosen_at: daysAgo(6), due_at: daysAgo(5), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(5), due_at: daysAgo(4), completed_at: null, verified: false }),
      makeActivation({ type: "micro_win", chosen_at: daysAgo(4), due_at: daysAgo(3), completed_at: null, verified: false }),
    ];
    const result = computeAIR(activations, "7d", NOW);
    expect(result.integritySlip).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Legacy hasThreeConsecutiveNonExecutionWarning
// ---------------------------------------------------------------------------

describe("hasThreeConsecutiveNonExecutionWarning (legacy)", () => {
  it("returns false for count < 3", () => {
    const ledger: AIRLedger = { chosenActivations: 5, executedActivations: 3, integrityResetActivations: 0, missedWindows: 2, consecutiveNonExecutionCount: 2 };
    expect(hasThreeConsecutiveNonExecutionWarning(ledger)).toBe(false);
  });

  it("returns true for count >= 3", () => {
    const ledger: AIRLedger = { chosenActivations: 5, executedActivations: 1, integrityResetActivations: 0, missedWindows: 4, consecutiveNonExecutionCount: 3 };
    expect(hasThreeConsecutiveNonExecutionWarning(ledger)).toBe(true);
  });
});
