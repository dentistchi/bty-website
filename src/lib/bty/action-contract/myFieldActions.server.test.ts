import { describe, it, expect, vi } from "vitest";
import { listMyFieldActions } from "./myFieldActions.server";

type Calls = { select: string | null; eq: Array<[string, unknown]>; in: Array<[string, unknown]>; order: Array<[string, unknown]> };

function makeAdmin(responder: (calls: Calls) => { data: unknown; error: unknown }, writeSpy: (op: string) => void) {
  const captured: { calls?: Calls } = {};
  const admin = {
    _c: captured,
    from() {
      const calls: Calls = { select: null, eq: [], in: [], order: [] };
      captured.calls = calls;
      const b: Record<string, unknown> = {
        select(c: string) { calls.select = c; return b; },
        eq(col: string, val: unknown) { calls.eq.push([col, val]); return b; },
        in(col: string, val: unknown) { calls.in.push([col, val]); return b; },
        order(col: string, opt: unknown) { calls.order.push([col, opt]); return b; },
        insert() { writeSpy("insert"); return b; },
        update() { writeSpy("update"); return b; },
        delete() { writeSpy("delete"); return b; },
        upsert() { writeSpy("upsert"); return b; },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve(responder(calls)).then(resolve, reject);
        },
      };
      return b;
    },
    rpc() { writeSpy("rpc"); return Promise.resolve({ data: null, error: null }); },
  };
  return admin;
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "c1", action_type: "field_action", status: "submitted",
  who: "My team lead", what: "Talk to Sam", how: "1:1", step_when: "Friday",
  contract_description: "배가 고파", revision_note: null,
  submitted_at: "2026-07-23T00:00:00Z", reviewed_at: null, verified_at: null, created_at: "2026-07-22T00:00:00Z",
  ...over,
});

describe("listMyFieldActions — canonical learner inventory", () => {
  it("scopes to the caller's own field_action contracts across the lifecycle (owner + type + statuses)", async () => {
    const write = vi.fn();
    const admin = makeAdmin(() => ({ data: [row()], error: null }), write);
    const items = await listMyFieldActions(admin as never, "U1");
    const calls = (admin as never as { _c: { calls: Calls } })._c.calls;
    expect(calls.eq).toContainEqual(["user_id", "U1"]);
    expect(calls.eq).toContainEqual(["action_type", "field_action"]);
    // Status scope covers the full field_action lifecycle (not just approved).
    const inStatuses = calls.in.find(([c]) => c === "status")?.[1] as string[];
    expect([...inStatuses].sort()).toEqual(["approved", "escalated", "pending", "rejected", "submitted"].sort());
    // Explicit column allow-list — never select('*'); no reviewer/audit/reflection columns.
    expect(calls.select).not.toContain("*");
    expect(calls.select).toContain("revision_note");
    expect(items).toHaveLength(1);
    expect(write).not.toHaveBeenCalled(); // read-only
  });

  it("maps a submitted contract to the canonical DTO (the bf5081c6-equivalent gap)", async () => {
    const admin = makeAdmin(() => ({ data: [row({ id: "bf5081c6", status: "submitted", contract_description: "배가 고파" })], error: null }), vi.fn());
    const items = await listMyFieldActions(admin as never, "U1");
    expect(items[0]).toEqual(expect.objectContaining({ contractId: "bf5081c6", status: "submitted", contractDescription: "배가 고파" }));
  });

  it("trims/normalizes a revision note (rejected) and null-safes empties", async () => {
    const admin = makeAdmin(() => ({ data: [row({ status: "rejected", revision_note: "  Name one person.  " })], error: null }), vi.fn());
    const items = await listMyFieldActions(admin as never, "U1");
    expect(items[0].revisionNote).toBe("Name one person.");
  });

  it("returns [] for a blank uid (no query)", async () => {
    const admin = makeAdmin(() => ({ data: [row()], error: null }), vi.fn());
    expect(await listMyFieldActions(admin as never, "   ")).toEqual([]);
  });

  it("throws on a query error (so the route can surface error≠empty)", async () => {
    const admin = makeAdmin(() => ({ data: null, error: { message: "boom" } }), vi.fn());
    await expect(listMyFieldActions(admin as never, "U1")).rejects.toThrow(/listMyFieldActions/);
  });
});
