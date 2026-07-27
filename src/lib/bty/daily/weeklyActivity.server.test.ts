import { describe, it, expect, vi } from "vitest";

// Canonical tz context is not under test here — pin it so the window math is deterministic.
vi.mock("@/lib/bty/daily/userDay", () => ({
  resolveUserTzContext: async () => ({ timezone: "UTC" }),
}));

import { loadWeeklyActivity } from "./weeklyActivity.server";

/**
 * A tiny chainable Supabase fake. Every builder is thenable; the resolved shape
 * depends on the table so we can assert canonical-source wiring and per-category
 * fail-soft WITHOUT a live DB. `dear_me_letters` deliberately errors to prove a
 * failing source is OMITTED (undefined) rather than shown as 0.
 */
function fakeAdmin(now: Date) {
  const gte: Record<string, string> = {};
  const lt: Record<string, string> = {};
  function builder(table: string) {
    const b: any = {
      select: () => b,
      eq: () => b,
      is: () => b,
      not: () => b,
      gte: (_c: string, v: string) => ((gte[table] = v), b),
      lt: (_c: string, v: string) => ((lt[table] = v), b),
      maybeSingle: async () =>
        table === "weekly_xp"
          ? { data: { xp_total: 42 }, error: null }
          : table === "arena_profiles"
            ? { data: { stage: 2 }, error: null }
            : { data: null, error: null },
      then: (resolve: (v: unknown) => void) => {
        if (table === "foundry_events") {
          resolve({ data: [{ program_id: "p1", created_at: now.toISOString() }], error: null });
        } else if (table === "dear_me_letters") {
          resolve({ count: null, error: { message: "boom" } }); // fail-soft path
        } else if (table === "user_day") {
          resolve({ count: 3, error: null });
        } else if (table === "foundry_event_training_progress") {
          resolve({ count: 1, error: null });
        } else if (table === "bty_action_contracts") {
          resolve({ count: 2, error: null });
        } else {
          resolve({ count: 0, error: null });
        }
      },
    };
    return b;
  }
  return { from: (t: string) => builder(t), _gte: gte, _lt: lt } as any;
}

describe("loadWeeklyActivity — canonical window + per-category fail-soft", () => {
  const now = new Date("2026-07-26T12:00:00Z");

  it("reads each metric from its canonical source and omits a failing one", async () => {
    const admin = fakeAdmin(now);
    const s = await loadWeeklyActivity(admin, "u1", now, "UTC");
    expect(s.weeklyPoints).toBe(42); // weekly_xp (NOT lifetime)
    expect(s.forgeStage).toBe(2); // arena_profiles.stage
    expect(s.activeDays).toBe(3); // user_day count
    expect(s.trainingsCompleted).toBe(1); // training progress
    expect(s.trainingsCreated).toBe(1); // first owned run in window
    expect(s.actionPlansCompleted).toBe(2); // approved field_action reviewed in window
    // dear_me_letters errored → OMITTED, never coerced to 0.
    expect(s.centerReflections).toBeUndefined();
  });

  it("scopes count windows to the last 7 BTY days (05:00 rollover), ending after today", async () => {
    const admin = fakeAdmin(now);
    await loadWeeklyActivity(admin, "u1", now, "UTC");
    const start = new Date(admin._gte["user_day"]);
    const end = new Date(admin._lt["user_day"]);
    // 7-day span (inclusive of today) = exactly 7 * 24h between the window bounds.
    expect((end.getTime() - start.getTime()) / (24 * 3600 * 1000)).toBe(7);
    // 05:00 UTC rollover boundary for the pinned UTC tz.
    expect(start.getUTCHours()).toBe(5);
  });
});
