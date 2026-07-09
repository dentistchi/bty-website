import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectDailyTrace } from "./dailyTrace.server";

type Row = { day_key: string; timezone_snapshot: string | null };

/** user_day stub: records every table queried; `.limit()` resolves the read. */
function sbUserDay(rows: Row[], queried?: string[]): SupabaseClient {
  return {
    from(table: string) {
      queried?.push(table);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: table === "user_day" ? rows : [], error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

/** Error stub: the read returns an error (exercises fail-soft). */
function sbError(): SupabaseClient {
  return {
    from() {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: null, error: { message: "boom" } }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("projectDailyTrace — Center Daily Trace (STEP 1B)", () => {
  it("sources ONLY user_day — never an Arena/weekly/leaderboard table", async () => {
    const queried: string[] = [];
    const now = new Date("2026-07-09T18:00:00Z");
    await projectDailyTrace(sbUserDay([{ day_key: "2026-07-09", timezone_snapshot: "UTC" }], queried), "u1", now);
    expect(queried).toEqual(["user_day"]);
    for (const t of queried) expect(t).not.toMatch(/arena|weekly|leaderboard|action_contract|xp/i);
  });

  it("returns 7 entries mapping user_day presence → intensity (present 1, missing 0)", async () => {
    const now = new Date("2026-07-09T18:00:00Z"); // 18:00 UTC ≥ 05:00 → todayKey 2026-07-09
    const rows: Row[] = [
      { day_key: "2026-07-09", timezone_snapshot: "UTC" },
      { day_key: "2026-07-07", timezone_snapshot: "UTC" },
    ];
    const { dailyTrace } = await projectDailyTrace(sbUserDay(rows), "u1", now);
    expect(dailyTrace).toHaveLength(7);
    expect(dailyTrace[6]).toEqual({ date: "2026-07-09", intensity: 1 });
    const byDate = Object.fromEntries(dailyTrace.map((p) => [p.date, p.intensity]));
    expect(byDate["2026-07-07"]).toBe(1);
    expect(byDate["2026-07-08"]).toBe(0);
    expect(byDate["2026-07-03"]).toBe(0);
  });

  it("resolves the day-key with the tz from user_day.timezone_snapshot (existing userDayKey logic, not UTC)", async () => {
    // 2026-07-10T06:00Z = 23:00 on 07-09 in America/Los_Angeles (before 05:00 → still 07-09),
    // but 06:00 on 07-10 in UTC. The snapshot tz must drive the key.
    const now = new Date("2026-07-10T06:00:00Z");
    const rows: Row[] = [{ day_key: "2026-07-09", timezone_snapshot: "America/Los_Angeles" }];
    const { dailyTrace } = await projectDailyTrace(sbUserDay(rows), "u1", now);
    expect(dailyTrace[6].date).toBe("2026-07-09"); // "today" per the user's tz
    expect(dailyTrace[6].intensity).toBe(1);
  });

  it("no rows → resting 7-day all-0 series (missing days are 0, never an error)", async () => {
    const now = new Date("2026-07-09T18:00:00Z");
    const { dailyTrace } = await projectDailyTrace(sbUserDay([]), "u1", now);
    expect(dailyTrace).toHaveLength(7);
    expect(dailyTrace.every((p) => p.intensity === 0)).toBe(true);
  });

  it("db error → fail-soft resting series, never throws into Me", async () => {
    const now = new Date("2026-07-09T18:00:00Z");
    const { dailyTrace } = await projectDailyTrace(sbError(), "u1", now);
    expect(dailyTrace).toHaveLength(7);
    expect(dailyTrace.every((p) => p.intensity === 0)).toBe(true);
  });

  it("response carries ONLY the numberless shape — no count/total/streak/xp/rank keys", async () => {
    const now = new Date("2026-07-09T18:00:00Z");
    const res = await projectDailyTrace(sbUserDay([{ day_key: "2026-07-09", timezone_snapshot: "UTC" }]), "u1", now);
    expect(Object.keys(res)).toEqual(["dailyTrace"]);
    for (const p of res.dailyTrace) expect(Object.keys(p).sort()).toEqual(["date", "intensity"]);
  });
});
