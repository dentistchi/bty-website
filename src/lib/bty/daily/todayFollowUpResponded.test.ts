import { describe, it, expect } from "vitest";
import { buildTodayReminders } from "./todayReminders.server";

/**
 * SLICE 3.2R-R3-R1 — an answered follow-up does NOT come back to Today.
 *
 * Founder decision D2 is explicit: a non-terminal answer must be reachable again, and it must not
 * return to Today merely because it is non-terminal. The way back lives in My Learning. R3-R1
 * changes no Today code at all, so what this file exists to do is PIN that — a later slice that
 * relaxes the PENDING filter to "make the check-in easier to find" has to delete a test that says
 * why it must not.
 *
 * IT USES ITS OWN STUB, ON PURPOSE. The stub in `todayReminders.server.test.ts` ignores `.eq()`
 * and returns whatever rows it was configured with, which is fine for the projection questions it
 * asks and useless here: the rule under test IS the `.eq("status", "PENDING")` filter, so a fake
 * that discards filters could only ever produce a green result that proves nothing. This one
 * applies eq/in/not against the rows, so the assertion can actually fail.
 */

type Row = Record<string, unknown>;

/** A PostgREST-shaped stub that HONOURS the filters — the point of this file. */
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

const NOW = new Date("2026-08-15T12:00:00Z");
const TZ = "UTC";

/**
 * One obligation, overdue but still INSIDE Today's attention window — the state that would shout
 * loudest if an answered row leaked.
 *
 * THE DUE DAY MOVED IN 3.2R-R3-R2, AND THAT IS THE POINT OF THE SLICE. It used to be 2026-08-01:
 * fourteen BTY days before NOW, which is now `stale` and correctly hidden from Today. Left alone,
 * this file's two presence assertions would have failed for the RIGHT reason and the question they
 * ask — "does an ANSWERED obligation stay out?" — would have gone untested, because an absence
 * proves nothing once the control can no longer produce a presence. So the fixture is pulled to
 * due − 5 days, still overdue and still the loudest thing on the surface. The window contract
 * itself is proven separately in `todayFollowUpStaleWindow.test.ts`.
 */
const followup = (over: Row = {}): Row => ({
  id: "fu-1",
  progress_id: "prog-1",
  user_id_snapshot: "u1",
  source_training_title: "Huddle ownership",
  follow_up_days: 7,
  due_at: "2026-08-10T05:00:00Z",
  status: "PENDING",
  outcome: null,
  ...over,
});

const build = (rows: Row[]) =>
  buildTodayReminders(
    filteringAdmin({ foundry_participant_followups: rows, foundry_participant_apply_windows: [] }),
    "u1",
    NOW,
    TZ,
    "en",
  );

describe("[3.2R-R3-R1] Today and the answered follow-up", () => {
  it("the stub is capable of failing — a PENDING obligation DOES reach Today", async () => {
    /*
      Asserted first and deliberately. Every other test here is an ABSENCE, and an absence proves
      nothing unless the same setup can produce a presence.
    */
    const out = await build([followup()]);
    expect(out.find((r) => r.stableId === "followup:fu-1")).toBeTruthy();
  });

  for (const outcome of ["PARTLY_APPLIED", "NOT_YET", "BLOCKED"]) {
    it(`a RESPONDED + ${outcome} obligation stays out of Today, though it is reachable from My Learning`, async () => {
      const out = await build([followup({ status: "RESPONDED", outcome })]);
      expect(out.find((r) => r.category === "FOLLOW_UP_DUE")).toBeUndefined();
    });
  }

  it("a RESPONDED + APPLIED obligation stays out of Today too", async () => {
    const out = await build([followup({ status: "RESPONDED", outcome: "APPLIED" })]);
    expect(out.find((r) => r.category === "FOLLOW_UP_DUE")).toBeUndefined();
  });

  it("answering one obligation does not remove another that is still pending", async () => {
    const out = await build([
      followup({ id: "fu-answered", status: "RESPONDED", outcome: "NOT_YET" }),
      followup({ id: "fu-open", progress_id: "prog-2" }),
    ]);
    expect(out.find((r) => r.stableId === "followup:fu-answered")).toBeUndefined();
    expect(out.find((r) => r.stableId === "followup:fu-open")).toBeTruthy();
  });

  it("building Today never writes — the projection has no mutating verb to call", async () => {
    /*
      The stub exposes only select/eq/in/not/order/limit. An insert/update/upsert/delete on this
      path would throw "is not a function" rather than silently succeed.
    */
    const out = await build([followup({ status: "RESPONDED", outcome: "NOT_YET" })]);
    expect(Array.isArray(out)).toBe(true);
  });
});
