import { describe, it, expect } from "vitest";
import {
  addDaysToDayKey,
  classifyFollowUpDue,
  computeFollowUpDue,
  isFollowUpDays,
  isFollowUpOutcome,
  FOLLOW_UP_OUTCOMES,
} from "./followUpObligation";
import { userDayKey } from "@/domain/daily/userDayKey";

/**
 * Slice 3.1B-3K — pure follow-up due-date contract. The deadline is materialized ONCE from the
 * completion's BTY day + N calendar days → 05:00-local start instant, DST-safe. Property-based
 * assertions (fixed-point + local-hour-5) so the tests are not brittle to hand-computed UTC.
 */

/** The wall-clock hour of a UTC instant in a given tz (to prove dueAt lands on the 05:00 boundary). */
function localHour(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(iso),
  );
  return Number(parts.find((p) => p.type === "hour")?.value);
}

describe("addDaysToDayKey", () => {
  it("advances a day key by N calendar days", () => {
    expect(addDaysToDayKey("2026-07-22", 7)).toBe("2026-07-29");
    expect(addDaysToDayKey("2026-07-22", 30)).toBe("2026-08-21");
  });
  it("crosses a month boundary", () => {
    expect(addDaysToDayKey("2026-07-28", 7)).toBe("2026-08-04");
  });
  it("crosses a year boundary", () => {
    expect(addDaysToDayKey("2026-12-30", 7)).toBe("2027-01-06");
  });
});

describe("isFollowUpDays / isFollowUpOutcome", () => {
  it("accepts only 7 and 30", () => {
    expect(isFollowUpDays(7)).toBe(true);
    expect(isFollowUpDays(30)).toBe(true);
    expect(isFollowUpDays(0)).toBe(false);
    expect(isFollowUpDays(14)).toBe(false);
    expect(isFollowUpDays(null)).toBe(false);
  });
  it("accepts only the four learner outcomes", () => {
    for (const o of FOLLOW_UP_OUTCOMES) expect(isFollowUpOutcome(o)).toBe(true);
    expect(isFollowUpOutcome("APPLIED")).toBe(true);
    expect(isFollowUpOutcome("VERIFIED")).toBe(false);
    expect(isFollowUpOutcome("")).toBe(false);
  });
});

describe("computeFollowUpDue", () => {
  it("test 18 — completion BEFORE 05:00 counts as the PREVIOUS BTY day", () => {
    const { completionBtyDay, dueBtyDay } = computeFollowUpDue("2026-07-22T02:00:00Z", "UTC", 7);
    expect(completionBtyDay).toBe("2026-07-21"); // 02:00 < 05:00 → previous day
    expect(dueBtyDay).toBe("2026-07-28");
  });

  it("test 19 — completion AFTER 05:00 counts as the CURRENT BTY day", () => {
    const { completionBtyDay, dueBtyDay } = computeFollowUpDue("2026-07-22T06:00:00Z", "UTC", 7);
    expect(completionBtyDay).toBe("2026-07-22"); // 06:00 ≥ 05:00 → current day
    expect(dueBtyDay).toBe("2026-07-29");
  });

  it("test 20 — due is EXACTLY N calendar BTY days after the completion day", () => {
    const c = computeFollowUpDue("2026-07-22T06:00:00Z", "UTC", 30);
    expect(c.dueBtyDay).toBe(addDaysToDayKey(c.completionBtyDay, 30));
  });

  it("dueAt lands on the 05:00-local START of the due BTY day (fixed-point property)", () => {
    const tz = "Asia/Seoul";
    const { dueBtyDay, dueAtIso } = computeFollowUpDue("2026-07-22T09:00:00Z", tz, 7);
    // fixed-point: the day the dueAt instant falls in (BTY-key'd) is exactly the due day.
    expect(userDayKey(new Date(dueAtIso), tz, 5)).toBe(dueBtyDay);
    expect(localHour(dueAtIso, tz)).toBe(5);
  });

  it("test 21 — spring-forward DST (America/Los_Angeles) still lands on 05:00 local", () => {
    const tz = "America/Los_Angeles"; // DST spring 2026-03-08
    const { dueBtyDay, dueAtIso } = computeFollowUpDue("2026-03-05T18:00:00Z", tz, 7); // completes 2026-03-05 local
    expect(dueBtyDay).toBe("2026-03-12"); // crosses the DST boundary
    expect(userDayKey(new Date(dueAtIso), tz, 5)).toBe(dueBtyDay);
    expect(localHour(dueAtIso, tz)).toBe(5); // still 05:00 local after the offset change
  });

  it("test 22 — fall-back DST (America/Los_Angeles) still lands on 05:00 local", () => {
    const tz = "America/Los_Angeles"; // DST fall 2026-11-01
    const { dueBtyDay, dueAtIso } = computeFollowUpDue("2026-10-28T18:00:00Z", tz, 7);
    expect(dueBtyDay).toBe("2026-11-04");
    expect(userDayKey(new Date(dueAtIso), tz, 5)).toBe(dueBtyDay);
    expect(localHour(dueAtIso, tz)).toBe(5);
  });

  it("test 24 — the computation is PURE/deterministic (no clock); same inputs → same dueAt", () => {
    const a = computeFollowUpDue("2026-07-22T09:00:00Z", "Asia/Seoul", 7);
    const b = computeFollowUpDue("2026-07-22T09:00:00Z", "Asia/Seoul", 7);
    expect(a).toEqual(b); // dueAt is fixed at creation; nothing recomputes it later
  });

  it("classifies day-granularly: the whole due BTY day is due_today, after is overdue, before is upcoming", () => {
    const tz = "UTC";
    const dueAt = "2026-07-29T05:00:00Z"; // 05:00-start of the 2026-07-29 BTY day
    // test 25 — anytime on the due BTY day → due_today (not prematurely overdue)
    expect(classifyFollowUpDue(dueAt, new Date("2026-07-29T05:00:00Z"), tz)).toBe("due_today");
    expect(classifyFollowUpDue(dueAt, new Date("2026-07-29T23:00:00Z"), tz)).toBe("due_today");
    // test 26 — a later BTY day → overdue
    expect(classifyFollowUpDue(dueAt, new Date("2026-07-30T06:00:00Z"), tz)).toBe("overdue");
    // test 27 — an earlier BTY day → upcoming (V1 hides these from Today)
    expect(classifyFollowUpDue(dueAt, new Date("2026-07-28T12:00:00Z"), tz)).toBe("upcoming");
  });

  it("resolves the due against the CREATION tz — a different tz yields a different fixed instant", () => {
    const seoul = computeFollowUpDue("2026-07-22T09:00:00Z", "Asia/Seoul", 7);
    const la = computeFollowUpDue("2026-07-22T09:00:00Z", "America/Los_Angeles", 7);
    // Same completion instant, different resolved tz → different stored due instant (both fixed).
    expect(seoul.dueAtIso).not.toBe(la.dueAtIso);
  });
});
