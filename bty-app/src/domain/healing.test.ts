/**
 * Healing / Awakening domain — constants and types (Q4).
 */
import { describe, it, expect } from "vitest";
import {
  AWAKENING_ACT_NAMES,
  AWAKENING_TRIGGER_DAY,
  AWAKENING_TRIGGER_MIN_SESSIONS,
  HEALING_PHASE_I_LABEL,
  HEALING_PHASE_II_LABEL,
  HEALING_PHASE_RING_TYPE,
} from "./healing";

describe("healing domain", () => {
  it("AWAKENING_ACT_NAMES has entries for act 1, 2, 3", () => {
    expect(AWAKENING_ACT_NAMES[1]).toBe("Reflection Chamber");
    expect(AWAKENING_ACT_NAMES[2]).toBe("Transition");
    expect(AWAKENING_ACT_NAMES[3]).toBe("Awakening");
  });

  it("AWAKENING_ACT_NAMES has exactly three keys (1, 2, 3)", () => {
    expect(Object.keys(AWAKENING_ACT_NAMES)).toEqual(["1", "2", "3"]);
  });

  it("HEALING_PHASE_I_LABEL and HEALING_PHASE_II_LABEL are Phase I and Phase II", () => {
    expect(HEALING_PHASE_I_LABEL).toBe("Phase I");
    expect(HEALING_PHASE_II_LABEL).toBe("Phase II");
  });

  it("HEALING_PHASE_RING_TYPE is phase_ring", () => {
    expect(HEALING_PHASE_RING_TYPE).toBe("phase_ring");
  });

  it("AWAKENING_TRIGGER_DAY and AWAKENING_TRIGGER_MIN_SESSIONS match spec defaults", () => {
    expect(AWAKENING_TRIGGER_DAY).toBe(30);
    expect(AWAKENING_TRIGGER_MIN_SESSIONS).toBe(10);
  });

  it("AWAKENING_TRIGGER_DAY and AWAKENING_TRIGGER_MIN_SESSIONS are numbers", () => {
    expect(typeof AWAKENING_TRIGGER_DAY).toBe("number");
    expect(typeof AWAKENING_TRIGGER_MIN_SESSIONS).toBe("number");
  });
});
