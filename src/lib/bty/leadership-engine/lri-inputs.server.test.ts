import { describe, it, expect } from "vitest";
import { computeLRIInputs } from "./lri-inputs.server";
import type { ActivationRecord } from "@/domain/leadership-engine/air";
import type { PulseRecord } from "@/domain/leadership-engine/pulse";

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
const pulse = (v: number, d: Date): PulseRecord => ({
  pulse_value: v,
  created_at: d,
});

describe("computeLRIInputs — pending (seam 3 / design §3)", () => {
  it("no pulse rows -> { pending: true }", () => {
    expect(computeLRIInputs([act({})], [], now)).toEqual({ pending: true });
  });

  it("all pulse rows out of 14d window -> { pending: true }", () => {
    const r = computeLRIInputs([act({})], [pulse(5, daysBefore(20))], now);
    expect(r).toEqual({ pending: true });
  });
});

describe("computeLRIInputs — populated", () => {
  it("hasPulse -> full inputs with RAW pulseMean (not normalized)", () => {
    const acts = [
      act({ completed_at: daysBefore(2), verified: true }),
      act({ completed_at: daysBefore(5), verified: true }),
    ];
    const pulses = [pulse(2, daysBefore(2)), pulse(4, daysBefore(5))]; // mean 3
    const r = computeLRIInputs(acts, pulses, now);
    expect(r.pending).toBe(false);
    if (r.pending === false) {
      expect(r.inputs.personalResponsibilityPulse).toBe(3); // raw, not 0.5
      expect(r.inputs.mwd14d).toBeCloseTo(2 / 14, 10);
      expect(r.inputs.noIntegritySlipIn14d).toBe(true);
      expect(typeof r.inputs.air14d).toBe("number");
    }
  });

  it("single pulse value passes through raw (5 -> 5, not 1)", () => {
    const r = computeLRIInputs([act({})], [pulse(5, daysBefore(1))], now);
    expect(r.pending).toBe(false);
    if (r.pending === false) {
      expect(r.inputs.personalResponsibilityPulse).toBe(5);
    }
  });
});
