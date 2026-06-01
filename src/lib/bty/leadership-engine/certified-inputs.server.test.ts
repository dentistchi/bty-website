import { describe, it, expect } from "vitest";
import { computeCertifiedInputs } from "./certified-inputs.server";
import type { ActivationRecord } from "@/domain/leadership-engine/air";

const MS_PER_DAY = 86_400_000;
const now = new Date("2026-05-31T00:00:00.000Z");
const daysBefore = (n: number): Date => new Date(now.getTime() - n * MS_PER_DAY);

let seq = 0;
function act(p: Partial<ActivationRecord>): ActivationRecord {
  seq += 1;
  return {
    activation_id: `a${seq}`,
    user_id: "u1",
    type: "micro_win",
    chosen_at: daysBefore(1),
    due_at: daysBefore(1),
    completed_at: daysBefore(1),
    verified: true,
    ...p,
  };
}

const NO_RESET = { forcedResetTriggeredAt: null, resetDueAt: null };

describe("computeCertifiedInputs — MWD (seam 1)", () => {
  it("counts only verified completed micro_win in 14d, divided by 14", () => {
    const acts = [
      act({ completed_at: daysBefore(2), verified: true }),
      act({ completed_at: daysBefore(5), verified: true }),
      act({ completed_at: daysBefore(2), verified: false }), // unverified excluded
      act({ type: "reset", completed_at: daysBefore(2), verified: true }), // non-micro excluded
      act({ completed_at: daysBefore(20), verified: true }), // out of window
      act({ completed_at: null, verified: true }), // not completed
    ];
    const r = computeCertifiedInputs(acts, NO_RESET, now);
    expect(r.mwd14d).toBeCloseTo(2 / 14, 10);
  });

  it("mwd anchors on completed_at, not chosen_at", () => {
    const acts = [
      // chosen in window but completed out of window -> excluded
      act({ chosen_at: daysBefore(1), completed_at: daysBefore(20) }),
    ];
    expect(computeCertifiedInputs(acts, NO_RESET, now).mwd14d).toBe(0);
  });
});

describe("computeCertifiedInputs — resetComplianceMet (seam 2, current-pending-honored)", () => {
  it("no trigger -> true", () => {
    expect(
      computeCertifiedInputs([], NO_RESET, now).resetComplianceMet,
    ).toBe(true);
  });

  it("triggered, within 48h grace (now <= resetDueAt) -> true", () => {
    const reset = {
      forcedResetTriggeredAt: daysBefore(1).toISOString(),
      resetDueAt: new Date(now.getTime() + 3600_000).toISOString(),
    };
    expect(computeCertifiedInputs([], reset, now).resetComplianceMet).toBe(true);
  });

  it("triggered, overdue (now > resetDueAt) -> false", () => {
    const reset = {
      forcedResetTriggeredAt: daysBefore(3).toISOString(),
      resetDueAt: daysBefore(1).toISOString(),
    };
    expect(computeCertifiedInputs([], reset, now).resetComplianceMet).toBe(false);
  });

  it("triggered but resetDueAt null -> false (defensive)", () => {
    const reset = {
      forcedResetTriggeredAt: daysBefore(1).toISOString(),
      resetDueAt: null,
    };
    expect(computeCertifiedInputs([], reset, now).resetComplianceMet).toBe(false);
  });
});

describe("computeCertifiedInputs — air + slip passthrough", () => {
  it("empty activations -> air14d 0, noIntegritySlipIn14d true", () => {
    const r = computeCertifiedInputs([], NO_RESET, now);
    expect(r.air14d).toBe(0);
    expect(r.noIntegritySlipIn14d).toBe(true);
  });
});
