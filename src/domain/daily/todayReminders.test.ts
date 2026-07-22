import { describe, it, expect } from "vitest";
import { classifyDue, sortReminders, dedupeReminders, type TodayReminder } from "./todayReminders";

/** Slice 3.1B-3J — deterministic reminder domain: due classification (05:00 boundary), priority, dedup. */

const now = new Date("2026-07-22T12:00:00Z"); // UTC, after 05:00 → today = 2026-07-22

describe("classifyDue (05:00 BTY-day boundary)", () => {
  it("past deadline → overdue", () => {
    expect(classifyDue("2026-07-22T04:00:00Z", now, "UTC")).toBe("overdue");
  });
  it("later today (same BTY day) → due_today", () => {
    expect(classifyDue("2026-07-22T20:00:00Z", now, "UTC")).toBe("due_today");
  });
  it("a future BTY day → upcoming", () => {
    expect(classifyDue("2026-07-23T20:00:00Z", now, "UTC")).toBe("upcoming");
  });
  it("pre-05:00 tomorrow still belongs to today's BTY day → due_today", () => {
    // 2026-07-23T03:00Z is before the 05:00 rollover → BTY day 2026-07-22 (same as today)
    expect(classifyDue("2026-07-23T03:00:00Z", now, "UTC")).toBe("due_today");
  });
});

function r(id: string, state: TodayReminder["state"], ts: string | null = null): TodayReminder {
  return { stableId: id, category: "ACTION_DUE", title: "t", state, sourceTimestamp: ts, roleContext: "learner", canonicalDeepLink: "/x" };
}

describe("sortReminders (deterministic priority)", () => {
  it("orders overdue → due_today → incomplete_required → upcoming", () => {
    const out = sortReminders([r("a", "upcoming"), r("b", "incomplete_required"), r("c", "due_today"), r("d", "overdue")]);
    expect(out.map((x) => x.state)).toEqual(["overdue", "due_today", "incomplete_required", "upcoming"]);
  });
  it("ties break by sourceTimestamp then stableId (total order)", () => {
    const out = sortReminders([r("z", "due_today", "2026-07-22T20:00:00Z"), r("a", "due_today", "2026-07-22T08:00:00Z")]);
    expect(out.map((x) => x.stableId)).toEqual(["a", "z"]);
  });
});

describe("dedupeReminders", () => {
  it("removes suppressed stable ids (dedup vs Today Intelligence primary)", () => {
    const out = dedupeReminders([r("action:1", "due_today"), r("action:2", "due_today")], new Set(["action:1"]));
    expect(out.map((x) => x.stableId)).toEqual(["action:2"]);
  });
  it("no-op when nothing to suppress", () => {
    expect(dedupeReminders([r("action:1", "due_today")], new Set()).length).toBe(1);
  });
});
