/**
 * Unit tests for TII weekly inputs (team list + GetTeamTIIInputs).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { getTeamIds } from "./tii-weekly-inputs";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(result: { data: unknown; error: Error | null }): SupabaseClient {
  const chain = {
    from: () => chain,
    select: () => Promise.resolve(result),
  };
  return chain as unknown as SupabaseClient;
}

describe("tii-weekly-inputs", () => {
  describe("getTeamIds", () => {
    it("returns empty array when query errors", async () => {
      const admin = mockSupabase({ data: null, error: new Error("db error") });
      const result = await getTeamIds(admin);
      expect(result).toEqual([]);
    });

    it("returns empty array when no rows", async () => {
      const admin = mockSupabase({ data: [], error: null });
      const result = await getTeamIds(admin);
      expect(result).toEqual([]);
    });

    it("returns league_id list when rows present", async () => {
      const data = [
        { league_id: "league-a" },
        { league_id: "league-b" },
      ];
      const admin = mockSupabase({ data, error: null });
      const result = await getTeamIds(admin);
      expect(result).toEqual(["league-a", "league-b"]);
    });

    it("returns single id when one row", async () => {
      const admin = mockSupabase({ data: [{ league_id: "only-one" }], error: null });
      const result = await getTeamIds(admin);
      expect(result).toEqual(["only-one"]);
    });
  });
});
