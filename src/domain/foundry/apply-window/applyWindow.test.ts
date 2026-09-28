import { describe, it, expect } from "vitest";
import {
  APPLY_WINDOW_DAYS,
  classifyApplyWindow,
  computeApplyWindow,
  isApplyWindowDays,
  suppressApplyWindow,
} from "./applyWindow";

/**
 * SLICE 3.2R-R2 — the apply window's calendar, proven rather than asserted.
 *
 * The BTY day boundary is 05:00 LOCAL, so every interesting case in this file is a case where
 * naive UTC arithmetic gives a different answer than the product means. DST is the sharpest of
 * them: two of these weeks are not 168 hours long, and the window is still seven days.
 */

const LA = "America/Los_Angeles";
const SEOUL = "Asia/Seoul";

describe("computeApplyWindow — the calendar", () => {
  it("opens on the completion BTY day and closes seven days later", () => {
    const w = computeApplyWindow("2026-08-14T20:00:00Z", LA); // 13:00 PDT Aug 14
    expect(w.completionBtyDay).toBe("2026-08-14");
    expect(w.dueBtyDay).toBe("2026-08-21");
  });

  it("a completion BEFORE 05:00 local belongs to the previous BTY day, and so does its window", () => {
    /*
      03:00 local is still "last night" in BTY terms. Getting this wrong would hand the learner an
      extra day, which sounds generous and is simply untrue.
    */
    const w = computeApplyWindow("2026-08-15T10:00:00Z", LA); // 03:00 PDT Aug 15
    expect(w.completionBtyDay).toBe("2026-08-14");
    expect(w.dueBtyDay).toBe("2026-08-21");
  });

  it("exactly 05:00 local starts the new BTY day", () => {
    const w = computeApplyWindow("2026-08-15T12:00:00Z", LA); // 05:00 PDT Aug 15
    expect(w.completionBtyDay).toBe("2026-08-15");
    expect(w.dueBtyDay).toBe("2026-08-22");
  });

  it("MONTH boundary", () => {
    const w = computeApplyWindow("2026-08-28T20:00:00Z", LA);
    expect(w.completionBtyDay).toBe("2026-08-28");
    expect(w.dueBtyDay).toBe("2026-09-04");
  });

  it("YEAR boundary", () => {
    const w = computeApplyWindow("2026-12-29T20:00:00Z", LA);
    expect(w.completionBtyDay).toBe("2026-12-29");
    expect(w.dueBtyDay).toBe("2027-01-05");
  });

  it("LEAP-YEAR February boundary", () => {
    const w = computeApplyWindow("2028-02-25T20:00:00Z", LA);
    expect(w.completionBtyDay).toBe("2028-02-25");
    expect(w.dueBtyDay).toBe("2028-03-03"); // 26,27,28,29,1,2,3 — the 29th is real
  });

  it("DST SPRING FORWARD — the week is 167 hours and still seven days", () => {
    // US DST begins 2027-03-14. A window opened on the 10th spans it.
    const w = computeApplyWindow("2027-03-10T20:00:00Z", LA);
    expect(w.completionBtyDay).toBe("2027-03-10");
    expect(w.dueBtyDay).toBe("2027-03-17");
    // The stored instant is the 05:00-LOCAL start of the due day, i.e. PDT (UTC-7), not PST.
    expect(w.dueAtIso).toBe("2027-03-17T12:00:00.000Z");
  });

  it("DST FALL BACK — the week is 169 hours and still seven days", () => {
    // US DST ends 2026-11-01. A window opened on 10-29 spans it.
    const w = computeApplyWindow("2026-10-29T20:00:00Z", LA);
    expect(w.completionBtyDay).toBe("2026-10-29");
    expect(w.dueBtyDay).toBe("2026-11-05");
    // 05:00 PST (UTC-8) on the due day — one hour later in UTC than a PDT due day would be.
    expect(w.dueAtIso).toBe("2026-11-05T13:00:00.000Z");
  });

  it("a zone with NO DST is unaffected, and its own 05:00 is used", () => {
    const w = computeApplyWindow("2026-10-29T20:00:00Z", SEOUL); // 05:00 KST Oct 30
    expect(w.completionBtyDay).toBe("2026-10-30");
    expect(w.dueBtyDay).toBe("2026-11-06");
    expect(w.dueAtIso).toBe("2026-11-05T20:00:00.000Z"); // 05:00 KST = 20:00Z previous day
  });

  it("is pure — same inputs, same output", () => {
    const a = computeApplyWindow("2026-08-14T20:00:00Z", LA);
    const b = computeApplyWindow("2026-08-14T20:00:00Z", LA);
    expect(a).toEqual(b);
  });

  it("the window length is 7 and nothing else may be stored", () => {
    expect(APPLY_WINDOW_DAYS).toBe(7);
    expect(isApplyWindowDays(7)).toBe(true);
    for (const bad of [0, 1, 30, -7, "7", null, undefined, 7.5]) {
      expect(isApplyWindowDays(bad), String(bad)).toBe(false);
    }
  });
});

describe("classifyApplyWindow — how it reads today", () => {
  const COMP = "2026-08-14";
  const DUE = "2026-08-21";
  const at = (iso: string) => classifyApplyWindow(COMP, DUE, new Date(iso), LA);

  it("the day it opens is ACTIVE, not upcoming — the learner is meant to act now", () => {
    expect(at("2026-08-14T20:00:00Z")).toBe("active");
  });

  it("mid-window is ACTIVE", () => {
    expect(at("2026-08-17T20:00:00Z")).toBe("active");
  });

  it("the day before close is still ACTIVE", () => {
    expect(at("2026-08-20T20:00:00Z")).toBe("active");
  });

  it("the due day is DUE_TODAY for the WHOLE day, including right after 05:00", () => {
    /*
      This is why the classifier is day-based. `dueAt` is the 05:00-local START of the due day, so
      an instant comparison would call the window overdue from its first minute — taking the last
      day away from the learner.
    */
    expect(at("2026-08-21T12:00:01Z")).toBe("due_today"); // 05:00:01 PDT
    expect(at("2026-08-21T20:00:00Z")).toBe("due_today");
    expect(at("2026-08-22T11:59:00Z")).toBe("due_today"); // 04:59 PDT — still the due BTY day
  });

  it("the day after close is OVERDUE", () => {
    expect(at("2026-08-22T20:00:00Z")).toBe("overdue");
  });

  it("before it opens is PENDING", () => {
    expect(at("2026-08-13T20:00:00Z")).toBe("pending");
  });

  it("classification follows the READER's timezone, not the stored snapshot", () => {
    // The same instant is a different BTY day in Seoul, so the same window reads differently.
    const inst = new Date("2026-08-21T16:00:00Z"); // 09:00 PDT Aug 21 / 01:00 KST Aug 22
    expect(classifyApplyWindow(COMP, DUE, inst, LA)).toBe("due_today");
    expect(classifyApplyWindow(COMP, DUE, inst, SEOUL)).toBe("due_today"); // 01:00 KST → still Aug 21 BTY
  });

  it("the state transition due_today → overdue happens at the 05:00 boundary, not midnight", () => {
    expect(at("2026-08-22T11:59:59Z")).toBe("due_today"); // 04:59:59 PDT
    expect(at("2026-08-22T12:00:00Z")).toBe("overdue"); // 05:00:00 PDT
  });
});

describe("suppressApplyWindow — the handoff, as a read rule", () => {
  it("shows the window while the follow-up is silent", () => {
    expect(suppressApplyWindow({ followUpIsAsking: false, followUpResponded: false })).toBe(false);
  });

  it("steps aside once the follow-up is asking", () => {
    expect(suppressApplyWindow({ followUpIsAsking: true, followUpResponded: false })).toBe(true);
  });

  it("stays aside once the follow-up has been answered", () => {
    expect(suppressApplyWindow({ followUpIsAsking: false, followUpResponded: true })).toBe(true);
  });

  it("is a pure predicate — it can only hide a row, never delete or mutate one", () => {
    const input = { followUpIsAsking: true, followUpResponded: false } as const;
    const copy = { ...input };
    suppressApplyWindow(input);
    expect(input).toEqual(copy);
  });
});

import {
  APPLY_ACTION_PICK_OFFSETS,
  applyActionDayPassed,
  isValidApplyActionDay,
  parseApplyActionChoice,
  resolveApplyActionDay,
} from "./applyWindow";

describe("APPLY ACTION DAY V1 — pure rules", () => {
  const C = "2026-09-24", D = "2026-10-01"; // completion day, due (follow-up) day

  it("parses only the strict wire tokens", () => {
    expect(parseApplyActionChoice("today")).toEqual({ kind: "today" });
    expect(parseApplyActionChoice("tomorrow")).toEqual({ kind: "tomorrow" });
    expect(parseApplyActionChoice("this_week")).toEqual({ kind: "this_week" });
    for (const n of APPLY_ACTION_PICK_OFFSETS) expect(parseApplyActionChoice(`pick:${n}`)).toEqual({ kind: "pick", offsetDays: n });
    for (const bad of ["Tomorrow", "tomorrow morning", "Friday", "next week", "2026-09-25", "pick:0", "pick:1", "pick:7", "pick:-1", "pick:2 ", 1, null, undefined, {}])
      expect(parseApplyActionChoice(bad)).toBeNull();
  });

  it("1/2/3. resolves Today / Tomorrow / a picked day against the COMPLETION day", () => {
    expect(resolveApplyActionDay({ kind: "today" }, C, D)).toBe("2026-09-24");
    expect(resolveApplyActionDay({ kind: "tomorrow" }, C, D)).toBe("2026-09-25");
    expect(resolveApplyActionDay({ kind: "pick", offsetDays: 2 }, C, D)).toBe("2026-09-26");
    expect(resolveApplyActionDay({ kind: "pick", offsetDays: 6 }, C, D)).toBe("2026-09-30");
  });

  it("Sometime this week and no choice → null (the 7-day window governs)", () => {
    expect(resolveApplyActionDay({ kind: "this_week" }, C, D)).toBeNull();
    expect(resolveApplyActionDay(null, C, D)).toBeNull();
  });

  it("5/6. completion <= day < due: before completion, the due day and after are all invalid — never clamped", () => {
    expect(isValidApplyActionDay("2026-09-23", C, D)).toBe(false);
    expect(isValidApplyActionDay("2026-09-24", C, D)).toBe(true);
    expect(isValidApplyActionDay("2026-09-30", C, D)).toBe(true);
    expect(isValidApplyActionDay("2026-10-01", C, D)).toBe(false);
    expect(isValidApplyActionDay("2026-10-02", C, D)).toBe(false);
    expect(isValidApplyActionDay("Tomorrow", C, D)).toBe(false);
    // An offset that would land on the due day resolves to null instead of a wrong day.
    expect(resolveApplyActionDay({ kind: "pick", offsetDays: 7 }, C, D)).toBeNull();
  });

  it("month and year boundaries resolve on the calendar, not by string arithmetic", () => {
    expect(resolveApplyActionDay({ kind: "tomorrow" }, "2026-09-30", "2026-10-07")).toBe("2026-10-01");
    expect(resolveApplyActionDay({ kind: "pick", offsetDays: 3 }, "2026-12-30", "2027-01-06")).toBe("2027-01-02");
  });

  it("7. passed is judged on the reader's BTY day (05:00 boundary), and null never passes", () => {
    const LA = "America/Los_Angeles";
    expect(applyActionDayPassed("2026-09-25", new Date("2026-09-26T11:59:00Z"), LA)).toBe(false); // 04:59 LA
    expect(applyActionDayPassed("2026-09-25", new Date("2026-09-26T12:00:00Z"), LA)).toBe(true);  // 05:00 LA
    expect(applyActionDayPassed(null, new Date("2027-01-01T00:00:00Z"), LA)).toBe(false);
    expect(applyActionDayPassed(undefined, new Date("2027-01-01T00:00:00Z"), LA)).toBe(false);
  });
});
