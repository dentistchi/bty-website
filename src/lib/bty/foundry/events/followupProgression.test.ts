import { describe, it, expect } from "vitest";
import { submitFollowupOutcome } from "./foundryFollowupService";

/**
 * SLICE 3.2M-3 — a later honest report is not a retry.
 *
 * The RPC settles the FIRST response and refuses everything after it. These pin the added
 * path: a learner may move on from a non-terminal answer, APPLIED is terminal, an identical
 * resubmission writes no history, and a lost race reports the settled truth rather than
 * overwriting it.
 */
type Row = Record<string, unknown>;

function makeAdmin(opts: {
  row: Row | null;
  /** What the conditional (compare-and-set) update returns — null models "lost the race". */
  updated?: Row | null;
  /** What a re-read after a lost race finds. */
  fresh?: Row | null;
  rpc?: unknown;
}) {
  const audits: Row[] = [];
  const updates: Row[] = [];
  let reads = 0;
  const admin = {
    from(table: string) {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      for (const m of ["eq", "in", "not", "order", "limit"]) b[m] = () => b;
      b.update = (patch: Row) => {
        updates.push(patch);
        return b;
      };
      b.insert = async (rows: Row) => {
        if (table === "foundry_participant_followup_audit") audits.push(rows);
        return { data: null, error: null };
      };
      b.maybeSingle = async () => {
        if (table !== "foundry_participant_followups") return { data: null };
        reads += 1;
        // 1st read = the pre-check; a later read only happens after a lost race.
        if (updates.length === 0) return { data: opts.row };
        return { data: reads > 2 ? (opts.fresh ?? null) : (opts.updated === undefined ? opts.row : opts.updated) };
      };
      (b as { then: unknown }).then = (res: (v: { data: unknown[] }) => unknown) =>
        Promise.resolve({ data: [] }).then(res);
      return b;
    },
    rpc: async () => ({ data: opts.rpc ?? null }),
  } as never;
  return { admin, audits, updates };
}

const USER = "user-1";
const ID = "f-1";
const responded = (outcome: string): Row => ({
  id: ID, event_id: "ev-1", user_id_snapshot: USER, status: "RESPONDED", outcome,
});

describe("[3.2M-3] later check-ins", () => {
  it("NOT_YET → APPLIED is allowed, and the earlier report is APPENDED, not erased", async () => {
    const { admin, audits, updates } = makeAdmin({
      row: responded("NOT_YET"),
      updated: { id: ID, outcome: "APPLIED", status: "RESPONDED" },
    });
    const r = await submitFollowupOutcome(admin, USER, ID, "APPLIED");
    expect(r).toEqual({ result: "responded", status: "RESPONDED", outcome: "APPLIED", canCheckInAgain: false });
    expect(updates[0]).toMatchObject({ outcome: "APPLIED" });
    // History gained a row; nothing was deleted.
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ followup_id: ID, event_type: "RESPONDED", outcome: "APPLIED", previous_status: "RESPONDED" });
  });

  it("BLOCKED → APPLIED and PARTLY_APPLIED → APPLIED are both allowed", async () => {
    for (const from of ["BLOCKED", "PARTLY_APPLIED"]) {
      const { admin, audits } = makeAdmin({
        row: responded(from),
        updated: { id: ID, outcome: "APPLIED", status: "RESPONDED" },
      });
      const r = await submitFollowupOutcome(admin, USER, ID, "APPLIED");
      expect(r.result, from).toBe("responded");
      expect(audits, from).toHaveLength(1);
    }
  });

  it("APPLIED cannot be downgraded — and no history row is written for the attempt", async () => {
    for (const to of ["NOT_YET", "PARTLY_APPLIED", "BLOCKED"]) {
      const { admin, audits, updates } = makeAdmin({ row: responded("APPLIED") });
      const r = await submitFollowupOutcome(admin, USER, ID, to);
      expect(r, to).toEqual({ result: "already_responded", status: "RESPONDED", outcome: "APPLIED", canCheckInAgain: false });
      expect(updates, to).toHaveLength(0);
      expect(audits, to).toHaveLength(0);
    }
  });

  it("the same answer again is idempotent — no update, no duplicate history", async () => {
    for (const same of ["APPLIED", "NOT_YET"]) {
      const { admin, audits, updates } = makeAdmin({ row: responded(same) });
      const r = await submitFollowupOutcome(admin, USER, ID, same);
      expect(r, same).toEqual({ result: "unchanged", status: "RESPONDED", outcome: same, canCheckInAgain: same !== "APPLIED" });
      expect(updates, same).toHaveLength(0);
      expect(audits, same).toHaveLength(0);
    }
  });

  it("a lost race reports the SETTLED truth, never what this caller intended", async () => {
    const { admin, audits } = makeAdmin({
      row: responded("NOT_YET"),
      updated: null,                                   // compare-and-set matched nothing
      fresh: { status: "RESPONDED", outcome: "APPLIED" }, // the other device won
    });
    const r = await submitFollowupOutcome(admin, USER, ID, "BLOCKED");
    expect(r).toEqual({ result: "already_responded", status: "RESPONDED", outcome: "APPLIED", canCheckInAgain: false });
    expect(audits, "a failed write must not leave history behind").toHaveLength(0);
  });

  it("another account cannot move someone else's report", async () => {
    const { admin, audits, updates } = makeAdmin({ row: responded("NOT_YET") });
    const r = await submitFollowupOutcome(admin, "someone-else", ID, "APPLIED");
    expect(r).toEqual({ result: "not_owner" });
    expect(updates).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("an invalid outcome never reaches any of this", async () => {
    const { admin, updates } = makeAdmin({ row: responded("NOT_YET") });
    expect(await submitFollowupOutcome(admin, USER, ID, "DEFINITELY_DID_IT")).toEqual({ result: "invalid_outcome" });
    expect(updates).toHaveLength(0);
  });

  it("a still-PENDING obligation defers to the RPC — the first report is not this path's business", async () => {
    const { admin, audits, updates } = makeAdmin({
      row: { id: ID, event_id: "ev-1", user_id_snapshot: USER, status: "PENDING", outcome: null },
      rpc: [{ result: "responded", status: "RESPONDED", outcome: "NOT_YET" }],
    });
    const r = await submitFollowupOutcome(admin, USER, ID, "NOT_YET");
    expect(r).toEqual({ result: "responded", status: "RESPONDED", outcome: "NOT_YET", canCheckInAgain: true });
    expect(updates, "the RPC does the first write, not us").toHaveLength(0);
    expect(audits, "and the RPC writes its own audit row").toHaveLength(0);
  });
});
