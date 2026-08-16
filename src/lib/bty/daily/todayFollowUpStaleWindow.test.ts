import { describe, it, expect } from "vitest";
import { buildTodayReminders } from "./todayReminders.server";

/**
 * SLICE 3.2R-R3-R2 — Today is not a permanent unresolved-record inbox.
 *
 * MEASURED DEFECT. Four live PENDING obligations were sitting in Today at STATE_RANK 0 — three of
 * them 13, 13 and 19 BTY days past their checkpoint — above genuinely urgent work, asking a
 * question the learner had already walked past every day for weeks. Nothing was wrong with the
 * data: the row is truthfully PENDING and truthfully overdue. What was wrong was that Today, a
 * time-bounded attention surface, had been given a durable obligation to hold forever.
 *
 * THE FOUNDER CONTRACT, IN CALENDAR DAYS: a PENDING follow-up may appear in Today from its
 * `due_bty_day` through `due_bty_day + 7`, INCLUSIVE. Day 8 and beyond, it must not.
 *
 * WHAT THIS FILE MUST PIN, BEYOND THE HAPPY PATH:
 *   * The boundary is exact and inclusive on BOTH ends — +7 in, +8 out. An off-by-one here is
 *     invisible in production for a week and then silently hides a live obligation a day early.
 *   * It is a CALENDAR-day rule, not a 168-hour rule. Proven across a real DST transition, where
 *     the two answers genuinely differ.
 *   * Leaving the window is a PROJECTION change and nothing else. The stub below has no mutating
 *     verb at all, so a status write, an outcome write or an `updated_at` touch cannot pass.
 *   * The stale row leaves by ELIGIBILITY, not by ranking. A card that is still built and merely
 *     sorted last is the same defect wearing better manners.
 *
 * It reuses the FILTERING stub shape from `todayFollowUpResponded.test.ts` rather than the
 * permissive one in `todayReminders.server.test.ts`: the rule under test is a filter, so a fake
 * that discards filters could only ever go green without proving anything.
 */

type Row = Record<string, unknown>;

/** A PostgREST-shaped stub that HONOURS filters and exposes NO mutating verb. */
function filteringAdmin(tables: Record<string, Row[]>) {
  function from(table: string) {
    let rows = (tables[table] ?? []).slice();
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (c: string, v: unknown) => {
        rows = rows.filter((r) => r[c] === v);
        return q;
      },
      in: (c: string, vs: unknown[]) => {
        rows = rows.filter((r) => vs.includes(r[c]));
        return q;
      },
      not: (c: string) => {
        rows = rows.filter((r) => r[c] !== null && r[c] !== undefined);
        return q;
      },
      then: (res: (v: { data: Row[] }) => unknown) => Promise.resolve({ data: rows }).then(res),
    };
    return q;
  }
  return { rpc: async () => ({ data: [] }), from } as never;
}

/*
  DETERMINISTIC CLOCK. `America/Los_Angeles` is the tz the live learners actually carry, and it is
  the one with a DST transition inside the range these cases span — so the calendar-day contract is
  tested in the frame where it can actually break, not in UTC where nothing can.

  NOW is 13:00 PDT on BTY day 2026-08-15. `dueOn(key)` returns the 05:00-local start instant of
  that BTY day — exactly what `computeFollowUpDue` materializes and stores.
*/
const TZ = "America/Los_Angeles";
const NOW = new Date("2026-08-15T20:00:00Z");

function dueOn(dayKey: string): string {
  /*
    The 05:00-local start instant of `dayKey`, found by probing rather than by assuming an offset —
    the whole point of this file is that −07:00 and −08:00 both occur in the range it spans. Only
    two UTC hours can be 05:00 local for a US Pacific date (12:00Z under PDT, 13:00Z under PST), so
    the correct one is identified by asking the tz database instead of computing it.
  */
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
    if (`${get("year")}-${get("month")}-${get("day")}` === dayKey && get("hour") === "05") {
      return d.toISOString();
    }
  }
  throw new Error(`no 05:00 local instant found for ${dayKey}`);
}

const followup = (over: Row = {}): Row => ({
  id: "fu-1",
  progress_id: "prog-1",
  user_id_snapshot: "u1",
  source_training_title: "Huddle ownership",
  follow_up_days: 7,
  due_at: dueOn("2026-08-15"),
  status: "PENDING",
  outcome: null,
  ...over,
});

const build = (rows: Row[], now: Date = NOW) =>
  buildTodayReminders(
    filteringAdmin({ foundry_participant_followups: rows, foundry_participant_apply_windows: [] }),
    "u1",
    now,
    TZ,
    "en",
  );

const shown = async (rows: Row[], now?: Date) =>
  (await build(rows, now)).some((r) => r.stableId === "followup:fu-1");

describe("[3.2R-R3-R2] the Today attention window for an unanswered follow-up", () => {
  /*
    THE BOUNDARY, DAY BY DAY. Written as one table rather than seven separate cases so the
    inclusive edge is readable as a shape: the transition happens once, between +7 and +8.
  */
  const cases: Array<[string, string, boolean]> = [
    ["the day before the checkpoint — not yet asked", "2026-08-16", false],
    ["the due day itself", "2026-08-15", true],
    ["due + 1", "2026-08-14", true],
    ["due + 6", "2026-08-09", true],
    ["due + 7 — the LAST day Today asks", "2026-08-08", true],
    ["due + 8 — the FIRST day it does not", "2026-08-07", false],
    ["due + 30 — long gone from Today, still owed", "2026-07-16", false],
  ];

  for (const [label, dueDay, visible] of cases) {
    it(`${label} → ${visible ? "visible in" : "hidden from"} Today`, async () => {
      expect(await shown([followup({ due_at: dueOn(dueDay) })])).toBe(visible);
    });
  }

  it("the control can produce a presence — an absence here is never vacuous", async () => {
    // The whole file argues from absences. This is the one assertion that proves the setup works.
    const out = await build([followup()]);
    expect(out.find((r) => r.stableId === "followup:fu-1")).toBeTruthy();
  });

  it("a surviving overdue row still reports 'overdue' — the window bounds asking, not truth", async () => {
    /*
      Founder Part C, pinned. `classifyFollowUpDue` is untouched: a follow-up five days past its
      checkpoint is overdue and says so, and still sorts at STATE_RANK 0. What R3-R2 changed is how
      LONG that is allowed to go on, not what it is called.
    */
    const out = await build([followup({ due_at: dueOn("2026-08-10") })]);
    const row = out.find((r) => r.stableId === "followup:fu-1");
    expect(row?.state).toBe("overdue");
  });

  it("the stale row is GONE, not demoted — nothing is left rendering at the bottom", async () => {
    /*
      The failure mode this rules out: solving the noise by re-ranking. A card sorted last is still
      a card, still counted, still there tomorrow. Eligibility is the mechanism.
    */
    const out = await build([followup({ due_at: dueOn("2026-07-16") })]);
    expect(out.filter((r) => r.category === "FOLLOW_UP_DUE")).toEqual([]);
  });

  it("one learner's stale row leaves while their live one stays", async () => {
    const out = await build([
      followup({ id: "fu-stale", due_at: dueOn("2026-07-16") }),
      followup({ id: "fu-live", progress_id: "prog-2", due_at: dueOn("2026-08-12") }),
    ]);
    expect(out.find((r) => r.stableId === "followup:fu-stale")).toBeUndefined();
    expect(out.find((r) => r.stableId === "followup:fu-live")).toBeTruthy();
  });

  for (const outcome of ["NOT_YET", "PARTLY_APPLIED", "BLOCKED", "APPLIED"]) {
    it(`a RESPONDED + ${outcome} row is out of Today at every age — R3-R1 unchanged`, async () => {
      for (const dueDay of ["2026-08-15", "2026-08-08", "2026-07-16"]) {
        const out = await build([followup({ status: "RESPONDED", outcome, due_at: dueOn(dueDay) })]);
        expect(out.find((r) => r.category === "FOLLOW_UP_DUE"), `${outcome} @ ${dueDay}`).toBeUndefined();
      }
    });
  }

  it("an unparseable deadline hides the row rather than shouting at rank 0", async () => {
    // The safe direction: a row whose due instant cannot be read asks LESS, never more.
    expect(await shown([followup({ due_at: "not-a-date" })])).toBe(false);
  });
});

describe("[3.2R-R3-R2] BTY calendar days, not 168 hours", () => {
  /*
    WHY THIS IS NOT A COSMETIC DISTINCTION. Across the 2026-11-01 fall-back transition, an
    America/Los_Angeles day is 25 hours long. A follow-up due on 2026-10-27 is, on 2026-11-03,
    exactly 7 CALENDAR days old — and 169 hours old. An elapsed-time rule would have hidden it a
    day early. The stored `due_at` is a fixed instant and is never rewritten, so this is a pure
    read-time question, which is exactly why it can be pinned here.
  */
  const NOV_3_NOON = new Date("2026-11-03T20:00:00Z"); // 12:00 PST on BTY day 2026-11-03

  it("due + 7 across the DST fall-back is still visible, though 168 hours have passed", async () => {
    const dueAt = dueOn("2026-10-27");
    const elapsedHours = (NOV_3_NOON.getTime() - Date.parse(dueAt)) / 3_600_000;
    expect(elapsedHours).toBeGreaterThan(168); // the naive rule would already have dropped it
    expect(await shown([followup({ due_at: dueAt })], NOV_3_NOON)).toBe(true);
  });

  it("due + 8 across the same transition is hidden — the calendar edge holds", async () => {
    expect(await shown([followup({ due_at: dueOn("2026-10-26") })], NOV_3_NOON)).toBe(false);
  });

  it("before the 05:00 BTY open hour, the day has not yet turned over", async () => {
    /*
      04:00 local on 2026-08-16 still belongs to BTY day 2026-08-15 (D1 open-hour rule). A row due
      on 2026-08-08 is therefore due + 7 and visible; an hour and a half later it is due + 8 and
      gone. Same obligation, same instant of storage — only the BTY day moved.
    */
    const beforeOpen = new Date("2026-08-16T11:00:00Z"); // 04:00 PDT
    const afterOpen = new Date("2026-08-16T13:00:00Z"); // 06:00 PDT
    const row = [followup({ due_at: dueOn("2026-08-08") })];
    expect(await shown(row, beforeOpen)).toBe(true);
    expect(await shown(row, afterOpen)).toBe(false);
  });
});

describe("[3.2R-R3-R2] becoming stale writes nothing", () => {
  it("the whole projection runs against a stub with no mutating verb at all", async () => {
    /*
      NO-WRITE, PROVEN STRUCTURALLY. The stub exposes select/eq/in/not/order/limit and nothing
      else — no insert, update, upsert, delete or rpc-write. If crossing the window boundary tried
      to record ANYTHING (a status change, a NOT_YET, a "missed" flag, an `updated_at` touch), it
      would throw "is not a function" here rather than pass quietly.

      Asserted for the stale row specifically, because that is the transition a future slice would
      be tempted to materialize.
    */
    const rows = [followup({ due_at: dueOn("2026-07-16") })];
    const out = await build(rows);
    expect(out.filter((r) => r.category === "FOLLOW_UP_DUE")).toEqual([]);
    // The caller's row object is the same object the stub read — unchanged, field for field.
    expect(rows[0]).toMatchObject({ status: "PENDING", outcome: null });
    expect(Object.keys(rows[0]!)).not.toContain("responded_at");
  });

  it("rendering Today repeatedly leaves the row exactly as it was", async () => {
    // Idempotence: staleness is derived on every read, never latched into the row.
    const rows = [followup({ due_at: dueOn("2026-07-16") })];
    const before = JSON.stringify(rows);
    await build(rows);
    await build(rows);
    await build(rows);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("[3.2R-R3-R2] legacy same-day rows need no repair", () => {
  it("a row whose due day equals its completion day projects by the ordinary rule", async () => {
    /*
      Two historical obligations were materialized with `due_bty_day == completion_bty_day` (a
      pre-fix authoring artefact). Founder Part H / D4: historical truth stays historical truth —
      no migration, no UPDATE, no normalization. They simply age out of Today like anything else,
      which is projection behaviour, not repair. Both live rows are RESPONDED and are covered by
      the R3-R1 rule above; this pins that the PENDING shape needs no special case either.
    */
    const sameDay = followup({ due_at: dueOn("2026-07-22") }); // 24 BTY days before NOW
    expect(await shown([sameDay])).toBe(false);
    const recentSameDay = followup({ due_at: dueOn("2026-08-11") }); // 4 days — still asking
    expect(await shown([recentSameDay])).toBe(true);
  });
});
