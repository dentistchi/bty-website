import { describe, it, expect } from "vitest";
import { weeklyOrbLights, minLightRadius, choosePopupPlacement, WEEKLY_LIGHT_COUNT } from "./weeklyOrbGeometry";

const SIZE = 200;
const CENTER = SIZE / 2;
// Sample many animation phases (seconds) to prove invariants across the whole loop.
const PHASES = Array.from({ length: 600 }, (_, i) => i * 0.1); // 0 … 60s

describe("weeklyOrbLights — seven-light integrity (B3A.2D-R3)", () => {
  it("produces exactly seven lights, one flagged as today (index 6)", () => {
    const lights = weeklyOrbLights(3.2, SIZE);
    expect(lights).toHaveLength(WEEKLY_LIGHT_COUNT);
    expect(WEEKLY_LIGHT_COUNT).toBe(7);
    const todays = lights.filter((l) => l.isToday);
    expect(todays).toHaveLength(1); // today modifies ONE existing light, not a new one
    expect(todays[0].i).toBe(6);
    expect(lights.map((l) => l.i)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("never collapses toward the centre — every light stays on the ring at every phase", () => {
    const floor = minLightRadius(SIZE); // 200*(0.30-0.03) = 54
    let globalMinDist = Infinity;
    for (const t of PHASES) {
      for (const l of weeklyOrbLights(t, SIZE)) {
        globalMinDist = Math.min(globalMinDist, l.distFromCenter);
      }
    }
    expect(globalMinDist).toBeGreaterThanOrEqual(floor - 1e-6);
    expect(globalMinDist).toBeGreaterThan(SIZE * 0.2); // no light ever near the centre
  });

  it("no phase presents a single central light (there is never a centroid at the centre)", () => {
    for (const t of PHASES) {
      const central = weeklyOrbLights(t, SIZE).filter((l) => l.distFromCenter < SIZE * 0.12);
      expect(central).toHaveLength(0);
      expect(weeklyOrbLights(t, SIZE)).toHaveLength(7); // and always exactly seven
    }
  });

  it("keeps a minimum pairwise separation so neighbouring lights never visually merge", () => {
    let globalMinPair = Infinity;
    for (const t of PHASES) {
      const ls = weeklyOrbLights(t, SIZE);
      for (let a = 0; a < ls.length; a++) {
        for (let b = a + 1; b < ls.length; b++) {
          globalMinPair = Math.min(globalMinPair, Math.hypot(ls[a].x - ls[b].x, ls[a].y - ls[b].y));
        }
      }
    }
    expect(globalMinPair).toBeGreaterThan(SIZE * 0.1); // > 20px separation at all times
  });

  it("today's light is one of the seven ring lights (no separate central emphasis dot)", () => {
    const ls = weeklyOrbLights(10, SIZE);
    const today = ls.find((l) => l.isToday)!;
    expect(today.distFromCenter).toBeGreaterThan(SIZE * 0.2); // today sits on the ring, not centre
    void CENTER;
  });
});

describe("choosePopupPlacement — collision-aware inline placement (B3A.2D-R3)", () => {
  it("prefers above when it fits below the top safe area", () => {
    expect(choosePopupPlacement({ anchorTop: 400, anchorBottom: 600, popupHeight: 120, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("above");
  });
  it("flips below when the above-top would cross the top safe area", () => {
    expect(choosePopupPlacement({ anchorTop: 100, anchorBottom: 300, popupHeight: 120, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("below");
  });
  it("falls back to above (with internal scroll) when neither fully fits", () => {
    expect(choosePopupPlacement({ anchorTop: 100, anchorBottom: 300, popupHeight: 700, viewportHeight: 800, safeTop: 56, margin: 10 })).toBe("above");
  });
});
