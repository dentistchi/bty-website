/**
 * Unit tests for Elite top 5% status (PHASE_4, mentor/elite perks).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { getIsEliteTop5 } from "./eliteStatus";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(rows: { user_id: string; xp_total: number }[], error: Error | null = null) {
  const chain = {
    from: () => chain,
    select: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error }),
  };
  return chain as unknown as SupabaseClient;
}

describe("eliteStatus", () => {
  describe("getIsEliteTop5", () => {
    it("returns false when query errors", async () => {
      const supabase = mockSupabase([], new Error("db error"));
      const result = await getIsEliteTop5(supabase, "user-1");
      expect(result).toBe(false);
    });

    it("returns false when no rows", async () => {
      const supabase = mockSupabase([]);
      const result = await getIsEliteTop5(supabase, "user-1");
      expect(result).toBe(false);
    });

    it("returns false when user not in list", async () => {
      const supabase = mockSupabase([
        { user_id: "other-1", xp_total: 100 },
        { user_id: "other-2", xp_total: 50 },
      ]);
      const result = await getIsEliteTop5(supabase, "user-missing");
      expect(result).toBe(false);
    });

    it("returns true when user is rank 1 (top 5% of 20)", async () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        user_id: i === 0 ? "top-user" : `user-${i}`,
        xp_total: 100 - i,
      }));
      const supabase = mockSupabase(rows);
      const result = await getIsEliteTop5(supabase, "top-user");
      expect(result).toBe(true);
    });

    it("returns false when user is below top 5% (rank 3 of 20)", async () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        user_id: i === 2 ? "mid-user" : `user-${i}`,
        xp_total: 100 - i,
      }));
      const supabase = mockSupabase(rows);
      const result = await getIsEliteTop5(supabase, "mid-user");
      expect(result).toBe(false);
    });
  });
});
