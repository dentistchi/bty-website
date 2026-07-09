import { describe, it, expect } from "vitest";
import { buildDailyTrace, recentDayKeys, previousDayKey } from "./dailyTrace";

describe("previousDayKey / recentDayKeys — BTY day labels", () => {
  it("previousDayKey crosses month / year / leap boundaries", () => {
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29"); // leap year
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("returns N recent keys ending at today, ordered oldest → today", () => {
    expect(recentDayKeys("2026-07-09", 7)).toEqual([
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
    ]);
  });
});

describe("buildDailyTrace — presence-as-light (STEP 1B)", () => {
  const today = "2026-07-09";

  it("returns exactly 7 entries, ordered oldest → today", () => {
    const t = buildDailyTrace(today, new Set(), 7);
    expect(t).toHaveLength(7);
    expect(t[0].date).toBe("2026-07-03");
    expect(t[6].date).toBe(today);
  });

  it("present day_key → intensity 1; missing day → intensity 0 (not an error)", () => {
    const t = buildDailyTrace(today, new Set(["2026-07-09", "2026-07-06"]), 7);
    const byDate = Object.fromEntries(t.map((p) => [p.date, p.intensity]));
    expect(byDate["2026-07-09"]).toBe(1);
    expect(byDate["2026-07-06"]).toBe(1);
    expect(byDate["2026-07-08"]).toBe(0);
    expect(byDate["2026-07-03"]).toBe(0);
  });

  it("is numberless: each entry has ONLY {date, intensity} — no count/total/streak/xp/rank", () => {
    const t = buildDailyTrace(today, new Set(["2026-07-09"]), 7);
    for (const p of t) {
      expect(Object.keys(p).sort()).toEqual(["date", "intensity"]);
      expect([0, 1]).toContain(p.intensity);
    }
  });

  it("a gap does not collapse the series — presence, not a streak", () => {
    // 07-07 present, 07-08 absent, 07-09 present → each day independent; no chain semantics.
    const t = buildDailyTrace(today, new Set(["2026-07-09", "2026-07-07"]), 7);
    const byDate = Object.fromEntries(t.map((p) => [p.date, p.intensity]));
    expect([byDate["2026-07-07"], byDate["2026-07-08"], byDate["2026-07-09"]]).toEqual([1, 0, 1]);
  });
});
