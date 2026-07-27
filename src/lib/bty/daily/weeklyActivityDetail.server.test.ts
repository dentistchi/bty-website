import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/bty/daily/userDay", () => ({
  resolveUserTzContext: async () => ({ timezone: "UTC" }),
}));

import { loadWeeklyActivityDetail } from "./weeklyActivity.server";

const DAY = 24 * 3600 * 1000;

/**
 * Chainable Supabase fake covering BOTH the summary count/head queries and the detail select
 * queries. Routes resolved rows by (table, isCount, selectCols). Records the dear_me_letters
 * select columns so the test can PROVE the reflection body is never read.
 */
function fakeAdmin(now: Date, sink: { reflectionSelect?: string; userDayGte?: string; userDayLt?: string }) {
  const todayStart = new Date(Date.UTC(2026, 6, 27, 5, 0, 0)); // 05:00 UTC BTY rollover for now
  function builder(table: string) {
    let isCount = false;
    let cols = "";
    const b: any = {
      select: (c: string, opts?: { head?: boolean }) => {
        cols = c;
        isCount = !!(opts && opts.head);
        if (table === "dear_me_letters" && !isCount) sink.reflectionSelect = c;
        return b;
      },
      eq: () => b,
      is: () => b,
      not: () => b,
      in: () => b,
      order: () => b,
      gte: (_c: string, v: string) => {
        if (table === "user_day" && !isCount) sink.userDayGte = v;
        return b;
      },
      lt: (_c: string, v: string) => {
        if (table === "user_day" && !isCount) sink.userDayLt = v;
        return b;
      },
      maybeSingle: async () =>
        table === "weekly_xp"
          ? { data: { xp_total: 42 }, error: null }
          : table === "arena_profiles"
            ? { data: { stage: 2 }, error: null }
            : { data: null, error: null },
      then: (resolve: (v: unknown) => void) => {
        if (isCount) {
          const counts: Record<string, number> = { user_day: 2, foundry_event_training_progress: 1, dear_me_letters: 0, bty_action_contracts: 3 };
          resolve({ count: counts[table] ?? 0, error: null });
          return;
        }
        if (table === "user_day") {
          resolve({ data: [{ opened_at: now.toISOString() }, { opened_at: new Date(now.getTime() - 2 * DAY).toISOString() }], error: null });
        } else if (table === "foundry_event_training_progress") {
          resolve({ data: [{ event_id: "e1", completed_at: now.toISOString() }], error: null });
        } else if (table === "foundry_events" && cols.includes("program_id") && cols.includes("title")) {
          resolve({ data: [{ program_id: "p1", title: "Program A", created_at: now.toISOString() }], error: null });
        } else if (table === "foundry_events" && cols.includes("title")) {
          resolve({ data: [{ id: "e1", title: "Course A" }], error: null });
        } else if (table === "foundry_events") {
          resolve({ data: [{ program_id: "p1", created_at: now.toISOString() }], error: null }); // summary runsCreated
        } else if (table === "dear_me_letters") {
          resolve({ data: [{ created_at: now.toISOString() }], error: null });
        } else if (table === "bty_action_contracts") {
          resolve({ data: [{ what: "Follow up with the new hire", reviewed_at: now.toISOString() }], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      },
    };
    void todayStart;
    return b;
  }
  return { from: (t: string) => builder(t) } as any;
}

describe("loadWeeklyActivityDetail (B3A.2D-R1)", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("returns the 7-day/05:00 window, attendance, and canonical item detail", async () => {
    const sink: { reflectionSelect?: string; userDayGte?: string; userDayLt?: string } = {};
    const d = await loadWeeklyActivityDetail(fakeAdmin(now, sink), "u1", now, "UTC");

    // Window bounds: 7 days incl. today, 05:00 UTC rollover.
    const start = new Date(sink.userDayGte!);
    const end = new Date(sink.userDayLt!);
    expect((end.getTime() - start.getTime()) / DAY).toBe(7);
    expect(start.getUTCHours()).toBe(5);

    // Attendance: exactly 7 dated days, 2 active (today + 2 days ago).
    expect(d.attendance).toHaveLength(7);
    expect(d.attendance!.filter((a) => a.active)).toHaveLength(2);
    expect(d.attendance!.every((a) => typeof a.date === "string")).toBe(true);

    // Item detail from canonical sources.
    expect(d.learningCompleted).toEqual([{ title: "Course A", date: now.toISOString() }]);
    expect(d.trainingCreated).toEqual([{ title: "Program A", date: now.toISOString() }]);
    expect(d.actionPlansCompleted).toEqual([{ title: "Follow up with the new hire", date: now.toISOString() }]);

    // Summary still present.
    expect(d.summary.weeklyPoints).toBe(42);
  });

  it("reads ONLY the date for Center reflections — the body is never selected (privacy)", async () => {
    const sink: { reflectionSelect?: string } = {};
    const d = await loadWeeklyActivityDetail(fakeAdmin(now, sink), "u1", now, "UTC");
    expect(sink.reflectionSelect).toBe("created_at");
    expect(d.centerReflections).toEqual([{ date: now.toISOString() }]);
    // No reflection carries a body/reply/prompt field.
    for (const r of d.centerReflections ?? []) {
      expect(Object.keys(r)).toEqual(["date"]);
    }
  });
});
