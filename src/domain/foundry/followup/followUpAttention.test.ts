import { describe, it, expect } from "vitest";
import {
  addDaysToDayKey,
  awaitsFirstResponse,
  canCheckInAgain,
  classifyFollowUpDue,
  classifyFollowUpTodayAttention,
  daysBetweenDayKeys,
  isFollowUpEligibleForToday,
  FOLLOW_UP_OUTCOMES,
  TODAY_ATTENTION_WINDOW_DAYS,
  type FollowUpStatus,
} from "./followUpObligation";

/**
 * SLICE 3.2R-R3-R2 — the pure authority behind the attention window.
 *
 * The end-to-end contract is proven through the canonical `buildTodayReminders` path in
 * `src/lib/bty/daily/todayFollowUpStaleWindow.test.ts`. What belongs HERE is what only a pure
 * function can be held to: that the two questions it answers are genuinely different questions,
 * that they cannot be satisfied by the same row, and that neither one redefines the classification
 * they are both layered on top of.
 */

const TZ = "America/Los_Angeles";
const NOW = new Date("2026-08-15T20:00:00Z"); // 13:00 PDT → BTY day 2026-08-15

/** 05:00 local on `dayKey` — what `computeFollowUpDue` materializes and stores. */
function dueOn(dayKey: string): string {
  for (const candidate of [`${dayKey}T12:00:00Z`, `${dayKey}T13:00:00Z`]) {
    const d = new Date(candidate);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    if (`${get("year")}-${get("month")}-${get("day")}` === dayKey && get("hour") === "05") return d.toISOString();
  }
  throw new Error(`no 05:00 local instant for ${dayKey}`);
}

const attention = (status: FollowUpStatus, dueDay: string, now: Date = NOW) =>
  classifyFollowUpTodayAttention(status, dueOn(dueDay), now, TZ);

describe("daysBetweenDayKeys — calendar arithmetic with no clock in it", () => {
  it("counts forward, backward and zero", () => {
    expect(daysBetweenDayKeys("2026-08-08", "2026-08-15")).toBe(7);
    expect(daysBetweenDayKeys("2026-08-15", "2026-08-15")).toBe(0);
    expect(daysBetweenDayKeys("2026-08-16", "2026-08-15")).toBe(-1);
  });

  it("crosses month and year ends", () => {
    expect(daysBetweenDayKeys("2026-07-27", "2026-08-03")).toBe(7);
    expect(daysBetweenDayKeys("2026-12-28", "2027-01-04")).toBe(7);
  });

  it("is the exact inverse of addDaysToDayKey, including over a DST transition", () => {
    /*
      The pairing is the guarantee: the deadline is MATERIALIZED with `addDaysToDayKey` and later
      MEASURED with this. If the two ever disagreed, an obligation could be created 7 days out and
      read as 6 or 8 days old. 2026-11-01 is the US fall-back — the case where an hour-based
      implementation of either one would drift.
    */
    for (const start of ["2026-08-15", "2026-10-27", "2026-02-28", "2026-12-31"]) {
      for (const n of [1, 7, 8, 30, 365]) {
        expect(daysBetweenDayKeys(start, addDaysToDayKey(start, n)), `${start} +${n}`).toBe(n);
      }
    }
  });
});

describe("classifyFollowUpTodayAttention — may Today still ask?", () => {
  it("the window is 7 days, inclusive, counted from the due day", () => {
    expect(TODAY_ATTENTION_WINDOW_DAYS).toBe(7);
    expect(attention("PENDING", "2026-08-16")).toBe("upcoming"); // due tomorrow
    expect(attention("PENDING", "2026-08-15")).toBe("asking"); // due today
    expect(attention("PENDING", "2026-08-14")).toBe("asking"); // +1
    expect(attention("PENDING", "2026-08-09")).toBe("asking"); // +6
    expect(attention("PENDING", "2026-08-08")).toBe("asking"); // +7, last day
    expect(attention("PENDING", "2026-08-07")).toBe("stale"); // +8, first day out
    expect(attention("PENDING", "2026-07-16")).toBe("stale"); // +30
  });

  it("a RESPONDED row is 'settled' at every age — Today is not its business", () => {
    for (const dueDay of ["2026-08-16", "2026-08-15", "2026-08-08", "2026-07-16"]) {
      expect(attention("RESPONDED", dueDay), dueDay).toBe("settled");
    }
  });

  it("does not redefine 'overdue' — the two classifications coexist and disagree on purpose", () => {
    /*
      Founder Part C. A 30-day-old unanswered follow-up is STILL truthfully overdue; the Host
      attention surface and the learner's due chip both still say so. Only Today's willingness to
      keep asking is bounded. If a later slice "simplifies" this by folding staleness into
      `classifyFollowUpDue`, this assertion is what stops it silently.
    */
    const stale = dueOn("2026-07-16");
    expect(classifyFollowUpDue(stale, NOW, TZ)).toBe("overdue");
    expect(classifyFollowUpTodayAttention("PENDING", stale, NOW, TZ)).toBe("stale");
  });

  it("an unparseable deadline resolves to 'upcoming' — the direction that asks less", () => {
    expect(classifyFollowUpTodayAttention("PENDING", "not-a-date", NOW, TZ)).toBe("upcoming");
  });

  it("is pure — the same inputs answer the same way, and the inputs are not mutated", () => {
    const due = dueOn("2026-08-08");
    const now = new Date(NOW);
    const first = classifyFollowUpTodayAttention("PENDING", due, now, TZ);
    expect(classifyFollowUpTodayAttention("PENDING", due, now, TZ)).toBe(first);
    expect(now.getTime()).toBe(NOW.getTime()); // no clock advanced, no argument rewritten
  });
});

describe("awaitsFirstResponse — the door Today expiry must not close", () => {
  it("stays true after the row leaves Today, at any age", () => {
    /*
      THE WHOLE POINT OF THE SLICE, in one assertion. `stale` means Today stops asking. It must
      never mean the learner can no longer answer.
    */
    for (const dueDay of ["2026-08-15", "2026-08-08", "2026-08-07", "2026-07-16", "2025-01-01"]) {
      expect(awaitsFirstResponse("PENDING", dueOn(dueDay), NOW, TZ), dueDay).toBe(true);
    }
  });

  it("is false before the checkpoint arrives — asking early is its own defect", () => {
    expect(awaitsFirstResponse("PENDING", dueOn("2026-08-16"), NOW, TZ)).toBe(false);
  });

  it("is false for every settled row, whatever the outcome", () => {
    expect(awaitsFirstResponse("RESPONDED", dueOn("2026-07-16"), NOW, TZ)).toBe(false);
  });
});

describe("PENDING and 'check in again' are disjoint — the semantics cannot be conflated", () => {
  /*
    "Check in again" and "You reported earlier" are FALSE for someone who has never answered. The
    only structural guarantee that a surface can never say them about a PENDING row is that no row
    can satisfy both predicates — `awaitsFirstResponse` requires PENDING, `canCheckInAgain`
    requires RESPONDED. Proven exhaustively over the whole status × outcome space rather than
    argued.
  */
  const outcomes = [null, ...FOLLOW_UP_OUTCOMES] as const;
  const statuses: FollowUpStatus[] = ["PENDING", "RESPONDED"];

  it("no (status, outcome, age) combination satisfies both routes", () => {
    for (const status of statuses) {
      for (const outcome of outcomes) {
        for (const dueDay of ["2026-08-16", "2026-08-15", "2026-08-08", "2026-07-16"]) {
          const first = awaitsFirstResponse(status, dueOn(dueDay), NOW, TZ);
          const again = canCheckInAgain(status, outcome);
          expect(first && again, `${status}/${outcome}/${dueDay}`).toBe(false);
        }
      }
    }
  });

  it("an unanswered obligation offers the first-response route and never the later-check-in one", () => {
    expect(awaitsFirstResponse("PENDING", dueOn("2026-07-16"), NOW, TZ)).toBe(true);
    expect(canCheckInAgain("PENDING", null)).toBe(false);
  });

  it("a settled non-terminal answer offers the later-check-in route and never the first one", () => {
    expect(canCheckInAgain("RESPONDED", "NOT_YET")).toBe(true);
    expect(awaitsFirstResponse("RESPONDED", dueOn("2026-08-15"), NOW, TZ)).toBe(false);
  });

  it("APPLIED is terminal on both routes", () => {
    expect(canCheckInAgain("RESPONDED", "APPLIED")).toBe(false);
    expect(awaitsFirstResponse("RESPONDED", dueOn("2026-08-15"), NOW, TZ)).toBe(false);
  });
});

/**
 * SLICE 3.2R-R3-R2-R1 — the suppression gate.
 *
 * Staleness alone no longer removes a row from Today. It takes staleness AND proof the learner can
 * still reach the obligation somewhere else, because R3-R2 as first written would have made one
 * live 19-day-old follow-up unreachable from every learner surface.
 */
describe("isFollowUpEligibleForToday — reachability outranks attention expiration", () => {
  it("the full truth table, both reachability values", () => {
    // settled / upcoming are never shown; asking is always shown; only `stale` consults the door.
    expect(isFollowUpEligibleForToday("settled", true)).toBe(false);
    expect(isFollowUpEligibleForToday("settled", false)).toBe(false);
    expect(isFollowUpEligibleForToday("upcoming", true)).toBe(false);
    expect(isFollowUpEligibleForToday("upcoming", false)).toBe(false);
    expect(isFollowUpEligibleForToday("asking", true)).toBe(true);
    expect(isFollowUpEligibleForToday("asking", false)).toBe(true);
    expect(isFollowUpEligibleForToday("stale", true)).toBe(false); // has a door → Today lets go
    expect(isFollowUpEligibleForToday("stale", false)).toBe(true); // no door → Today keeps asking
  });

  it("reachability changes the answer for stale rows and NOTHING else", () => {
    /*
      The amendment must be surgical: the only cell in the table where the second argument matters
      is `stale`. If a later edit lets reachability influence `asking` or `upcoming`, it has turned
      an identity fact into a general visibility rule, and this fails.
    */
    for (const attention of ["settled", "upcoming", "asking"] as const) {
      expect(isFollowUpEligibleForToday(attention, true), attention).toBe(
        isFollowUpEligibleForToday(attention, false),
      );
    }
    expect(isFollowUpEligibleForToday("stale", true)).not.toBe(isFollowUpEligibleForToday("stale", false));
  });

  it("composes with the time classification without redefining it", () => {
    // A stale row kept for lack of a door is STILL stale, and still truthfully overdue.
    const stale = dueOn("2026-07-16");
    expect(classifyFollowUpTodayAttention("PENDING", stale, NOW, TZ)).toBe("stale");
    expect(classifyFollowUpDue(stale, NOW, TZ)).toBe("overdue");
    expect(isFollowUpEligibleForToday("stale", false)).toBe(true);
  });

  it("is pure — no clock, no I/O, same answer every time", () => {
    for (let i = 0; i < 3; i++) expect(isFollowUpEligibleForToday("stale", false)).toBe(true);
  });

  it("an unanswered obligation is never suppressed AND unreachable at the same time", () => {
    /*
      THE INVARIANT THE WHOLE AMENDMENT EXISTS FOR, stated directly: for every PENDING obligation,
      Today hiding it implies the learner has another way in. Swept over the full space rather than
      argued in a comment.
    */
    for (const attention of ["upcoming", "asking", "stale"] as const) {
      for (const reachable of [true, false]) {
        const hiddenFromToday = !isFollowUpEligibleForToday(attention, reachable);
        // `upcoming` is exempt: the checkpoint has not arrived, so there is nothing yet to reach.
        if (attention === "upcoming") continue;
        expect(hiddenFromToday && !reachable, `${attention}/${reachable}`).toBe(false);
      }
    }
  });
});
