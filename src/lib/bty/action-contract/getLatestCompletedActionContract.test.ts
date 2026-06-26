import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestCompletedActionContract } from "./getLatestCompletedActionContract";

/** Build a supabase stub whose query chain resolves maybeSingle to `result`, capturing filters. */
function supabaseStub(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown> = {};
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockImplementation((col: string, val: unknown) => {
    calls.eqCol = col;
    calls.eqVal = val;
    return chain;
  });
  chain.not.mockImplementation((col: string, op: string, val: unknown) => {
    calls.notArgs = [col, op, val];
    return chain;
  });
  chain.order.mockImplementation((col: string, opts: unknown) => {
    calls.orderArgs = [col, opts];
    return chain;
  });
  chain.limit.mockImplementation((n: number) => {
    calls.limit = n;
    return chain;
  });
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe("getLatestCompletedActionContract", () => {
  it("queries verified contracts for the user, newest first, limit 1", async () => {
    const { client, calls, from } = supabaseStub({
      data: { id: "c1", contract_description: "Call the family", verified_at: "2026-06-25T10:00:00Z" },
      error: null,
    });

    const res = await getLatestCompletedActionContract(client, "user-1");

    expect(from).toHaveBeenCalledWith("bty_action_contracts");
    expect(calls.eqCol).toBe("user_id");
    expect(calls.eqVal).toBe("user-1");
    expect(calls.notArgs).toEqual(["verified_at", "is", null]);
    expect(calls.orderArgs).toEqual(["verified_at", { ascending: false }]);
    expect(calls.limit).toBe(1);
    expect(res).toEqual({
      id: "c1",
      contractDescription: "Call the family",
      verifiedAt: "2026-06-25T10:00:00Z",
    });
  });

  it("returns null when there is no completed contract", async () => {
    const { client } = supabaseStub({ data: null, error: null });
    expect(await getLatestCompletedActionContract(client, "user-1")).toBeNull();
  });

  it("returns null on query error", async () => {
    const { client } = supabaseStub({ data: null, error: { message: "boom" } });
    expect(await getLatestCompletedActionContract(client, "user-1")).toBeNull();
  });
});
