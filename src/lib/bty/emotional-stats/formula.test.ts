/**
 * v3 formula tests: Q, stat delta, session gains, stat_distribution, 30-day acc + phase.
 * Single source: docs/specs/healing-coaching-spec-v3.json.
 */
import { describe, it, expect } from "vitest";
import {
  computeSessionQualityQ,
  computeStatDelta,
  clampDelta,
  computeSessionGains,
  BASE_GAIN,
  MAX_GAIN_PER_STAT_PER_SESSION,
} from "./formula";
import { EVENT_IDS, getQualityWeight, STAT_DISTRIBUTION, type EmotionalEventId } from "./coreStats";

describe("computeSessionQualityQ", () => {
  it("returns 0 for empty session", () => {
    expect(computeSessionQualityQ([])).toBe(0);
  });
  it("caps by SESSION_MAX_POSSIBLE_EVENTS_CAP (8)", () => {
    const many = [...EVENT_IDS];
    expect(many.length).toBe(15);
    const q = computeSessionQualityQ(many as EmotionalEventId[]);
    expect(q).toBeLessThanOrEqual(1);
    expect(q).toBeGreaterThan(0);
  });
  it("Q in [0, 1]", () => {
    const one: EmotionalEventId[] = ["FEELING_LABELED"];
    expect(computeSessionQualityQ(one)).toBeGreaterThan(0);
    expect(computeSessionQualityQ(one)).toBeLessThanOrEqual(1);
  });
});

describe("computeStatDelta", () => {
  it("without userDay: base_gain * Q * novelty * consistency (no acc/phase)", () => {
    const delta = computeStatDelta(1, 1, 1, BASE_GAIN);
    expect(delta).toBeCloseTo(BASE_GAIN);
  });
  it("with userDay applies acc and phase_multiplier", () => {
    const noDay = computeStatDelta(1, 1, 1, BASE_GAIN);
    const day5 = computeStatDelta(1, 1, 1, BASE_GAIN, 5);
    expect(day5).not.toBe(noDay);
    expect(day5).toBeGreaterThan(0);
  });
  it("novelty clamped [0.2, 1]", () => {
    const d = computeStatDelta(1, 0, 1, BASE_GAIN);
    expect(d).toBeGreaterThanOrEqual(BASE_GAIN * 0.2);
  });
});

describe("clampDelta", () => {
  it("clamps to maxPerSession", () => {
    expect(clampDelta(10, 1.5)).toBe(1.5);
    expect(clampDelta(0.5, 1.5)).toBe(0.5);
  });
  it("returns 0 for negative", () => {
    expect(clampDelta(-1)).toBe(0);
  });
});

describe("computeSessionGains", () => {
  it("returns all core stats with 0 for empty session", () => {
    const gains = computeSessionGains([], 1, 1);
    expect(Object.keys(gains).sort()).toEqual(["BS", "EA", "RC", "RD", "RS", "TI"]);
    expect(gains.EA).toBe(0);
    expect(gains.RS).toBe(0);
  });
  it("distributes by STAT_DISTRIBUTION per event", () => {
    const session: EmotionalEventId[] = ["SELF_REFRAMING"];
    const gains = computeSessionGains(session, 1, 1, 1);
    expect(gains.RD).toBeGreaterThan(0);
    expect(gains.EA).toBeGreaterThan(0);
    expect(gains.RS).toBeGreaterThan(0);
  });
  it("15 event types supported (STAT_DISTRIBUTION per event)", () => {
    expect(EVENT_IDS.length).toBe(15);
    for (const id of EVENT_IDS) {
      const weights = STAT_DISTRIBUTION[id as EmotionalEventId];
      expect(weights).toBeDefined();
      const sum = Object.values(weights ?? {}).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    }
  });
  it("EMPATHY_EXPRESSED distributes to EA and RC", () => {
    const session: EmotionalEventId[] = ["EMPATHY_EXPRESSED"];
    const gains = computeSessionGains(session, 1, 1);
    expect(gains.EA).toBeGreaterThan(0);
    expect(gains.RC).toBeGreaterThan(0);
    expect(gains.BS).toBe(0);
    expect(gains.TI).toBe(0);
  });
  it("each stat gain is clamped to MAX_GAIN_PER_STAT_PER_SESSION", () => {
    const many: EmotionalEventId[] = ["O_F_N_R_COMPLETED", "O_F_N_R_COMPLETED", "O_F_N_R_COMPLETED"];
    const gains = computeSessionGains(many, 1, 1.4, 1);
    for (const v of Object.values(gains)) {
      expect(v).toBeLessThanOrEqual(MAX_GAIN_PER_STAT_PER_SESSION);
    }
  });
});

describe("v3 constants from spec", () => {
  it("15 events with quality_weight", () => {
    expect(EVENT_IDS.length).toBe(15);
    for (const id of EVENT_IDS) {
      expect(getQualityWeight(id)).toBeGreaterThan(0);
    }
  });
});
