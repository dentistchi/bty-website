/**
 * Unit tests for active league (B-MVP 30-day window).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { findActiveLeague, type ActiveLeague } from "./activeLeague";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(
  result: { data: unknown; error: Error | null }
): SupabaseClient {
  const chain = {
    from: () => chain,
    select: () => chain,
    not: () => chain,
    lte: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(result),
  };
  return chain as unknown as SupabaseClient;
}

describe("activeLeague", () => {
  describe("findActiveLeague", () => {
    it("returns null when query errors", async () => {
      const supabase = mockSupabase({ data: null, error: new Error("db error") });
      const result = await findActiveLeague(supabase);
      expect(result).toBeNull();
    });

    it("returns null when no rows", async () => {
      const supabase = mockSupabase({ data: [], error: null });
      const result = await findActiveLeague(supabase);
      expect(result).toBeNull();
    });

    it("returns league when one row", async () => {
      const row = {
        league_id: "league-1",
        start_at: "2026-01-25T00:00:00.000Z",
        end_at: "2026-02-24T23:59:59.999Z",
        name: "Season 2026-01-25",
      };
      const supabase = mockSupabase({ data: [row], error: null });
      const result = await findActiveLeague(supabase);
      expect(result).not.toBeNull();
      expect((result as ActiveLeague).league_id).toBe("league-1");
      expect((result as ActiveLeague).start_at).toBe(row.start_at);
      expect((result as ActiveLeague).end_at).toBe(row.end_at);
      expect((result as ActiveLeague).name).toBe(row.name);
    });

    it("returns first row when multiple (order end_at desc)", async () => {
      const rows = [
        { league_id: "a", start_at: "2026-01-01Z", end_at: "2026-01-31Z", name: "A" },
        { league_id: "b", start_at: "2025-12-01Z", end_at: "2025-12-31Z", name: "B" },
      ];
      const supabase = mockSupabase({ data: rows, error: null });
      const result = await findActiveLeague(supabase);
      expect(result?.league_id).toBe("a");
    });
  });
});
