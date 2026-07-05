import { describe, it, expect } from "vitest";
import { userDayKey } from "./userDayKey";
import { normalizeDayKey, previousDayKey, nextStreakState } from "./streakBridge";

describe("streakBridge — legacy format normalization", () => {
  it("(a) pads unpadded legacy keys; passes padded through", () => {
    expect(normalizeDayKey("2026-7-4")).toBe("2026-07-04");
    expect(normalizeDayKey("2026-11-3")).toBe("2026-11-03");
    expect(normalizeDayKey("2026-07-04")).toBe("2026-07-04");
    expect(normalizeDayKey("garbage")).toBe("");
    expect(normalizeDayKey(null as unknown as string)).toBe("");
  });

  it("previousDayKey crosses month/year boundaries (calendar, not 24h drift)", () => {
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28"); // 2026 not a leap year
    expect(previousDayKey("2027-01-01")).toBe("2026-12-31");
    expect(previousDayKey("2026-07-04")).toBe("2026-07-03");
  });
});

describe("streakBridge — nextStreakState (D1 legacy bridge invariants)", () => {
  it("first ever run seeds streak=1 and writes", () => {
    const r = nextStreakState(null, "2026-07-04");
    expect(r).toEqual({ state: { streak: 1, lastDayKey: "2026-07-04" }, changed: true });
  });

  it("(b) normalize-before-compare — raw lexical compare would misfire ('2026-7-4' vs '2026-11-03')", () => {
    // Raw "2026-7-4" > "2026-11-03" is TRUE lexically (would wrongly trip the future-guard).
    // After normalization "2026-07-04" < "2026-11-03" → not same-day, not future → reset to 1.
    const r = nextStreakState({ streak: 9, lastDayKey: "2026-7-4" }, "2026-11-03");
    expect(r.changed).toBe(true);
    expect(r.state.streak).toBe(1);
    expect(r.state.lastDayKey).toBe("2026-11-03");
  });

  it("(c) boundary guard — future lastDayKey (midnight→05:00 window) is same-day, marker preserved, no write", () => {
    // Old midnight system stamped "2026-07-04" at 03:00 local; canonical current day is 07-03.
    const r = nextStreakState({ streak: 5, lastDayKey: "2026-07-04" }, "2026-07-03");
    expect(r.changed).toBe(false);
    expect(r.state.streak).toBe(5);
    expect(r.state.lastDayKey).toBe("2026-07-04"); // future marker NOT overwritten
  });

  it("same-day (already canonical) → no change, no write", () => {
    const r = nextStreakState({ streak: 4, lastDayKey: "2026-07-04" }, "2026-07-04");
    expect(r).toEqual({ state: { streak: 4, lastDayKey: "2026-07-04" }, changed: false });
  });

  it("(d) yesterday via calendar −1 on today's key — DST divergence proves instant−24h is NOT used", () => {
    // Instant 2026-03-08T12:30Z in LA is 05:30 PDT → today = 2026-03-08.
    const todayKey = userDayKey(new Date("2026-03-08T12:30:00Z"), "America/Los_Angeles", 5);
    expect(todayKey).toBe("2026-03-08");
    // Correct yesterday = 2026-03-07. A broken userDayKey(instant−24h) would yield 2026-03-06
    // (2026-03-07T12:30Z is 04:30 PST, before the open hour) → would reset instead of increment.
    const r = nextStreakState({ streak: 5, lastDayKey: "2026-03-07" }, todayKey);
    expect(r.changed).toBe(true);
    expect(r.state.streak).toBe(6);
  });

  it("(e) normal continuation — yesterday match increments", () => {
    const r = nextStreakState({ streak: 2, lastDayKey: "2026-07-03" }, "2026-07-04");
    expect(r.state.streak).toBe(3);
    expect(r.changed).toBe(true);
  });

  it("(f) break — day-before-yesterday resets to 1", () => {
    const r = nextStreakState({ streak: 7, lastDayKey: "2026-07-02" }, "2026-07-04");
    expect(r.state.streak).toBe(1);
    expect(r.changed).toBe(true);
  });
});
