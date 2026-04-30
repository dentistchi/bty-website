import { describe, expect, it, vi } from "vitest";
import {
  fetchBlockingArenaContractForSession,
  userHasBlockingArenaActionContract,
} from "./blockingArenaActionContract";

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeSupabaseMock(row: Record<string, unknown> | null) {
  const chain: QueryChain = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gt.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: row, error: null });

  const from = vi.fn(() => chain);
  return { supabase: { from } as unknown, chain, from };
}

describe("blockingArenaActionContract", () => {
  it("treats pending contracts as blocking", async () => {
    const pending = {
      id: "c1",
      contract_description: "desc",
      deadline_at: new Date(Date.now() + 60_000).toISOString(),
      verification_mode: "hybrid",
      created_at: new Date().toISOString(),
      status: "pending",
    };
    const { supabase } = makeSupabaseMock(pending);
    const row = await fetchBlockingArenaContractForSession(
      supabase as Parameters<typeof fetchBlockingArenaContractForSession>[0],
      "u1",
    );
    expect(row?.id).toBe("c1");
  });

  it("queries pending status only for ACTION_REQUIRED gate", async () => {
    const { supabase, chain } = makeSupabaseMock(null);
    await fetchBlockingArenaContractForSession(
      supabase as Parameters<typeof fetchBlockingArenaContractForSession>[0],
      "u1",
    );
    expect(chain.eq).toHaveBeenCalledWith("status", "pending");
    expect(chain.gt).toHaveBeenCalled();
  });

  it("returns false when no pending contract exists", async () => {
    const { supabase } = makeSupabaseMock(null);
    const blocked = await userHasBlockingArenaActionContract(
      supabase as Parameters<typeof userHasBlockingArenaActionContract>[0],
      "u1",
    );
    expect(blocked).toBe(false);
  });
});

