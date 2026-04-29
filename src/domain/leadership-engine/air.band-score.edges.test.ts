/**
 * AIR 밴드·점수 경계 (238 C3). Action–Integrity–Responsibility 스펙 밴드 단일 소스.
 */
import { describe, it, expect } from "vitest";
import {
  airToBand,
  AIR_BAND_LOW_MID,
  AIR_BAND_MID_HIGH,
  AIR_THRESHOLD_STAGE_ESCALATION,
  computeAIR,
  type ActivationRecord,
} from "./air";

const NOW = new Date("2026-06-01T12:00:00Z");
const DAY = 86_400_000;

function act(
  type: ActivationRecord["type"],
  chosenDaysAgo: number,
  completed: boolean
): ActivationRecord {
  const chosen = new Date(NOW.getTime() - chosenDaysAgo * DAY);
  return {
    activation_id: `a-${chosenDaysAgo}-${type}`,
    user_id: "u1",
    type,
    chosen_at: chosen,
    due_at: new Date(chosen.getTime() + DAY),
    completed_at: completed ? new Date(chosen.getTime() + 12 * 3600 * 1000) : null,
    verified: completed,
  };
}

describe("AIR band / score edges (238)", () => {
  it("airToBand: just below LOW_MID → low; at LOW_MID → mid; just below MID_HIGH → mid; at MID_HIGH → high", () => {
    expect(airToBand(AIR_BAND_LOW_MID - 0.001)).toBe("low");
    expect(airToBand(AIR_BAND_LOW_MID)).toBe("mid");
    expect(airToBand(AIR_BAND_MID_HIGH - 0.001)).toBe("mid");
    expect(airToBand(AIR_BAND_MID_HIGH)).toBe("high");
  });

  it("AIR_THRESHOLD_STAGE_ESCALATION aligns with low-band upper bound (stage 3→4 air_below_threshold)", () => {
    expect(AIR_THRESHOLD_STAGE_ESCALATION).toBe(AIR_BAND_LOW_MID);
    expect(airToBand(AIR_THRESHOLD_STAGE_ESCALATION - 0.01)).toBe("low");
    expect(airToBand(AIR_THRESHOLD_STAGE_ESCALATION)).toBe("mid");
  });

  it("computeAIR score clamps to [0,1] under heavy penalty (band low)", () => {
    const manyMissed: ActivationRecord[] = [];
    for (let i = 0; i < 15; i++) {
      manyMissed.push(act("micro_win", 6 - i * 0.2, false));
    }
    const r = computeAIR(manyMissed, "7d", NOW);
    expect(r.air).toBe(0);
    expect(airToBand(r.air)).toBe("low");
  });

  it("perfect window → air 1 → high band", () => {
    const r = computeAIR([act("micro_win", 3, true)], "7d", NOW);
    expect(r.air).toBe(1);
    expect(airToBand(r.air)).toBe("high");
  });
});
