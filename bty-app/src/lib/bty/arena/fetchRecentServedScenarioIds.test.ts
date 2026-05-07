import { describe, expect, it, vi } from "vitest";
import { fetchRecentServedScenarioIds } from "./fetchRecentServedScenarioIds";

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
};

function makeSupabaseMock(rows: Array<{ scenario_id: unknown }> | null) {
  const chain: QueryChain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.gte.mockResolvedValue({ data: rows, error: null });
  const from = vi.fn(() => chain);
  return { supabase: { from } as unknown, chain, from };
}

describe("fetchRecentServedScenarioIds", () => {
  it("returns scenario_ids from recent arena_runs", async () => {
    const { supabase } = makeSupabaseMock([{ scenario_id: "s1" }, { scenario_id: "s2" }]);
    const ids = await fetchRecentServedScenarioIds(
      supabase as Parameters<typeof fetchRecentServedScenarioIds>[0],
      "u1",
    );
    expect(ids).toEqual(["s1", "s2"]);
  });

  it("filters non-string scenario_id values", async () => {
    const { supabase } = makeSupabaseMock([
      { scenario_id: "s1" },
      { scenario_id: null },
      { scenario_id: 42 },
    ]);
    const ids = await fetchRecentServedScenarioIds(
      supabase as Parameters<typeof fetchRecentServedScenarioIds>[0],
      "u1",
    );
    expect(ids).toEqual(["s1"]);
  });

  it("returns [] when query yields null data (preserves silent-error behavior)", async () => {
    const { supabase } = makeSupabaseMock(null);
    const ids = await fetchRecentServedScenarioIds(
      supabase as Parameters<typeof fetchRecentServedScenarioIds>[0],
      "u1",
    );
    expect(ids).toEqual([]);
  });

  it("queries arena_runs with status whitelist + user_id + 24h window by default", async () => {
    const { supabase, chain, from } = makeSupabaseMock([]);
    const before = Date.now();
    await fetchRecentServedScenarioIds(
      supabase as Parameters<typeof fetchRecentServedScenarioIds>[0],
      "u1",
    );
    const after = Date.now();
    expect(from).toHaveBeenCalledWith("arena_runs");
    expect(chain.select).toHaveBeenCalledWith("scenario_id");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.in).toHaveBeenCalledWith("status", ["DONE", "IN_PROGRESS", "ABANDONED"]);
    const sinceArg = chain.gte.mock.calls[0][1] as string;
    const sinceMs = new Date(sinceArg).getTime();
    expect(sinceMs).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000);
    expect(sinceMs).toBeLessThanOrEqual(after - 24 * 60 * 60 * 1000);
  });

  it("respects custom windowHours", async () => {
    const { supabase, chain } = makeSupabaseMock([]);
    const before = Date.now();
    await fetchRecentServedScenarioIds(
      supabase as Parameters<typeof fetchRecentServedScenarioIds>[0],
      "u1",
      48,
    );
    const after = Date.now();
    const sinceMs = new Date(chain.gte.mock.calls[0][1] as string).getTime();
    expect(sinceMs).toBeGreaterThanOrEqual(before - 48 * 60 * 60 * 1000);
    expect(sinceMs).toBeLessThanOrEqual(after - 48 * 60 * 60 * 1000);
  });
});
