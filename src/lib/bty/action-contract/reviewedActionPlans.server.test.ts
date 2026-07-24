import { describe, it, expect, vi } from "vitest";
import { listMyReviewedActionPlans } from "./reviewedActionPlans.server";

type Calls = {
  select: string | null;
  eq: Array<[string, unknown]>;
  in: Array<[string, unknown]>;
  not: Array<[string, string, unknown]>;
};

/** Chainable fake: records filters, resolves per table, and flags any write. */
function makeAdmin(
  responder: (table: string, calls: Calls) => { data: unknown; error: unknown },
  writeSpy: (op: string) => void,
) {
  const lastCalls: { contracts?: Calls; module?: Calls } = {};
  const admin = {
    _lastCalls: lastCalls,
    from(table: string) {
      const calls: Calls = { select: null, eq: [], in: [], not: [] };
      if (table === "bty_action_contracts") lastCalls.contracts = calls;
      if (table === "foundry_event_module") lastCalls.module = calls;
      const builder: Record<string, unknown> = {
        select(c: string) { calls.select = c; return builder; },
        eq(col: string, val: unknown) { calls.eq.push([col, val]); return builder; },
        in(col: string, val: unknown) { calls.in.push([col, val]); return builder; },
        not(col: string, op: string, val: unknown) { calls.not.push([col, op, val]); return builder; },
        returns() { return builder; },
        insert() { writeSpy("insert"); return builder; },
        update() { writeSpy("update"); return builder; },
        delete() { writeSpy("delete"); return builder; },
        upsert() { writeSpy("upsert"); return builder; },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve(responder(table, calls)).then(resolve, reject);
        },
      };
      return builder;
    },
    rpc() { writeSpy("rpc"); return Promise.resolve({ data: null, error: null }); },
  };
  return admin;
}

function contractRow(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    action_type: "field_action",
    status: "approved",
    who: "My team lead",
    what: "Review one handoff",
    how: "Agree one owner",
    step_when: "By Friday",
    contract_description: "Leading under pressure",
    reviewed_at: "2026-07-24T03:00:00Z",
    verified_at: "2026-07-24T03:00:00Z",
    completed_at: "2026-07-24T03:00:00Z",
    submitted_at: "2026-07-23T00:00:00Z",
    created_at: "2026-07-22T00:00:00Z",
    details: { source: { kind: "foundry_field_action", event_id: "ev1", progress_id: "p1", assignment_id: "a1", participant_id: "pt1" } },
    ...over,
  };
}

describe("listMyReviewedActionPlans", () => {
  it("projects an approved field_action into one card with module version + review date", async () => {
    const write = vi.fn();
    const admin = makeAdmin((table) => {
      if (table === "bty_action_contracts") return { data: [contractRow()], error: null };
      if (table === "foundry_event_module") return { data: [{ event_id: "ev1", module_version: 2 }], error: null };
      return { data: [], error: null };
    }, write);

    const cards = await listMyReviewedActionPlans(admin as never, "U1");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      contractId: "c1",
      who: "My team lead",
      what: "Review one handoff",
      how: "Agree one owner",
      stepWhen: "By Friday",
      moduleTitle: "Leading under pressure",
      moduleVersion: 2,
      reviewedAt: "2026-07-24T03:00:00Z",
    });
    // no reviewer identity / audit / reflection field leaked
    expect(Object.keys(cards[0]).sort()).toEqual(
      ["contractId", "how", "moduleTitle", "moduleVersion", "reviewedAt", "stepWhen", "what", "who"].sort(),
    );
    expect(write).not.toHaveBeenCalled();
  });

  it("issues the eligibility filters (own + field_action + approved + verified_at NOT NULL)", async () => {
    const admin = makeAdmin((table) =>
      table === "bty_action_contracts" ? { data: [contractRow()], error: null } : { data: [], error: null },
    vi.fn());
    await listMyReviewedActionPlans(admin as never, "U1");
    const c = (admin as unknown as { _lastCalls: { contracts: Calls } })._lastCalls.contracts;
    expect(c.eq).toContainEqual(["user_id", "U1"]);
    expect(c.eq).toContainEqual(["action_type", "field_action"]);
    expect(c.eq).toContainEqual(["status", "approved"]);
    expect(c.not).toContainEqual(["verified_at", "is", null]);
    expect(c.select).not.toContain("response_text");
    expect(c.select).not.toContain("reviewer");
  });

  it("dedupes duplicate contract ids into one card", async () => {
    const admin = makeAdmin((table) =>
      table === "bty_action_contracts"
        ? { data: [contractRow(), contractRow()], error: null }
        : { data: [{ event_id: "ev1", module_version: 1 }], error: null },
    vi.fn());
    const cards = await listMyReviewedActionPlans(admin as never, "U1");
    expect(cards).toHaveLength(1);
  });

  it("sorts newest reviewed first, tie-broken by contract id", async () => {
    const admin = makeAdmin((table) =>
      table === "bty_action_contracts"
        ? {
            data: [
              contractRow({ id: "old", reviewed_at: "2026-07-20T00:00:00Z", verified_at: "2026-07-20T00:00:00Z" }),
              contractRow({ id: "new", reviewed_at: "2026-07-24T00:00:00Z", verified_at: "2026-07-24T00:00:00Z" }),
            ],
            error: null,
          }
        : { data: [], error: null },
    vi.fn());
    const cards = await listMyReviewedActionPlans(admin as never, "U1");
    expect(cards.map((c) => c.contractId)).toEqual(["new", "old"]);
  });

  it("does not guess module version when lineage is missing (no event_id / no module row)", async () => {
    const admin = makeAdmin((table) =>
      table === "bty_action_contracts"
        ? { data: [contractRow({ id: "noev", details: { source: { kind: "foundry_field_action" } } })], error: null }
        : { data: [], error: null },
    vi.fn());
    const cards = await listMyReviewedActionPlans(admin as never, "U1");
    expect(cards[0].moduleVersion).toBeNull();
    expect(cards[0].moduleTitle).toBe("Leading under pressure"); // title still shown; ownership proven
  });

  it("returns [] for empty user id and never queries", async () => {
    const write = vi.fn();
    const admin = makeAdmin(() => ({ data: [contractRow()], error: null }), write);
    expect(await listMyReviewedActionPlans(admin as never, "  ")).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  it("fail-soft: DB error yields [] (never throws into My Learning)", async () => {
    const admin = makeAdmin(() => ({ data: null, error: { message: "boom" } }), vi.fn());
    expect(await listMyReviewedActionPlans(admin as never, "U1")).toEqual([]);
  });
});
