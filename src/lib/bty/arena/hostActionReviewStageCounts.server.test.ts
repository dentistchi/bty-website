import { describe, it, expect, vi } from "vitest";
import { getHostActionReviewStageCounts } from "./hostActionReviewQueue.server";

type Calls = {
  select: string | null;
  eq: Array<[string, unknown]>;
  in: Array<[string, unknown]>;
  is: Array<[string, unknown]>;
};

function makeAdmin(
  responder: (table: string, calls: Calls) => { data: unknown; error: unknown },
  writeSpy: (op: string) => void,
) {
  const seen: { contracts?: Calls } = {};
  const admin = {
    _seen: seen,
    from(table: string) {
      const calls: Calls = { select: null, eq: [], in: [], is: [] };
      if (table === "bty_action_contracts") seen.contracts = calls;
      const b: Record<string, unknown> = {
        select(c: string) { calls.select = c; return b; },
        eq(col: string, v: unknown) { calls.eq.push([col, v]); return b; },
        in(col: string, v: unknown) { calls.in.push([col, v]); return b; },
        is(col: string, v: unknown) { calls.is.push([col, v]); return b; },
        returns() { return b; },
        insert() { writeSpy("insert"); return b; },
        update() { writeSpy("update"); return b; },
        delete() { writeSpy("delete"); return b; },
        then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) {
          return Promise.resolve(responder(table, calls)).then(res, rej);
        },
      };
      return b;
    },
    rpc() { writeSpy("rpc"); return Promise.resolve({ data: null, error: null }); },
  };
  return admin;
}

const ACTOR_MEMS = [{ id: "mh", user_id: "HOST", organization_id: "o1", status: "active" }];
const EDGES = [{ learner_membership_id: "ml1" }, { learner_membership_id: "ml2" }];
const LEARNER_MEMS = [
  { id: "ml1", user_id: "L1", organization_id: "o1", status: "active" },
  { id: "ml2", user_id: "L2", organization_id: "o1", status: "active" },
];

function baseResponder(contractRows: unknown[]) {
  return (table: string, calls: Calls) => {
    if (table === "bty_org_memberships") {
      return calls.eq.some(([c]) => c === "user_id")
        ? { data: ACTOR_MEMS, error: null }
        : { data: LEARNER_MEMS, error: null };
    }
    if (table === "bty_org_action_review_authority") return { data: EDGES, error: null };
    if (table === "bty_action_contracts") return { data: contractRows, error: null };
    return { data: [], error: null };
  };
}

describe("getHostActionReviewStageCounts", () => {
  it("buckets distinct field_action ids by lifecycle stage", async () => {
    const write = vi.fn();
    const rows = [
      { id: "s1", status: "submitted", verified_at: null },
      { id: "s2", status: "submitted", verified_at: null },
      { id: "r1", status: "rejected", verified_at: null },
      { id: "a1", status: "approved", verified_at: "2026-07-24T00:00:00Z" },
      { id: "a1", status: "approved", verified_at: "2026-07-24T00:00:00Z" }, // duplicate id → counted once
      { id: "e1", status: "escalated", verified_at: null },
    ];
    const admin = makeAdmin(baseResponder(rows), write);
    const counts = await getHostActionReviewStageCounts(admin as never, "HOST");
    expect(counts).toEqual({ verificationPending: 2, needsRevision: 1, reviewedAccepted: 1, awaitingResolution: 1 });
    expect(write).not.toHaveBeenCalled();
  });

  it("filters action_type='field_action' explicitly (Arena actions never counted) and scopes to edge-reachable learners", async () => {
    const admin = makeAdmin(baseResponder([{ id: "a1", status: "approved", verified_at: "t" }]), vi.fn());
    await getHostActionReviewStageCounts(admin as never, "HOST");
    const c = (admin as unknown as { _seen: { contracts: Calls } })._seen.contracts;
    expect(c.eq).toContainEqual(["action_type", "field_action"]);
    expect(c.in).toContainEqual(["user_id", ["L1", "L2"]]);
  });

  it("a submitted row that already has verified_at lands in NO bucket (no overlap / no double-count)", async () => {
    const admin = makeAdmin(baseResponder([{ id: "x", status: "submitted", verified_at: "t" }]), vi.fn());
    const counts = await getHostActionReviewStageCounts(admin as never, "HOST");
    expect(counts).toEqual({ verificationPending: 0, needsRevision: 0, reviewedAccepted: 0, awaitingResolution: 0 });
  });

  it("returns zeros for an actor with no ACTION_REVIEWER edges (unauthorized scope)", async () => {
    const admin = makeAdmin((table, calls) => {
      if (table === "bty_org_memberships" && calls.eq.some(([c]) => c === "user_id")) return { data: ACTOR_MEMS, error: null };
      if (table === "bty_org_action_review_authority") return { data: [], error: null };
      return { data: [], error: null };
    }, vi.fn());
    const counts = await getHostActionReviewStageCounts(admin as never, "HOST");
    expect(counts).toEqual({ verificationPending: 0, needsRevision: 0, reviewedAccepted: 0, awaitingResolution: 0 });
  });

  it("renders operational counts even below cohort size 5 (a single approved plan)", async () => {
    const admin = makeAdmin(baseResponder([{ id: "a1", status: "approved", verified_at: "t" }]), vi.fn());
    const counts = await getHostActionReviewStageCounts(admin as never, "HOST");
    expect(counts.reviewedAccepted).toBe(1); // no min-N suppression on responsibility-scoped counts
  });

  it("returns zeros for empty actor id", async () => {
    const write = vi.fn();
    const admin = makeAdmin(baseResponder([]), write);
    expect(await getHostActionReviewStageCounts(admin as never, " ")).toEqual({
      verificationPending: 0, needsRevision: 0, reviewedAccepted: 0, awaitingResolution: 0,
    });
    expect(write).not.toHaveBeenCalled();
  });
});
