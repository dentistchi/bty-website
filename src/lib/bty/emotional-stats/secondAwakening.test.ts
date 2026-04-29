/**
 * Unit tests for Second Awakening (30-day ritual).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { getSecondAwakening } from "./secondAwakening";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabaseNotEligible(): SupabaseClient {
  const firstSessionChain = {
    from: () => firstSessionChain,
    select: () => firstSessionChain,
    eq: () => firstSessionChain,
    order: () => firstSessionChain,
    limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
  };
  const countChain = {
    from: () => countChain,
    select: (_c: string, _opts?: { count?: string; head?: boolean }) => ({
      eq: () => Promise.resolve({ data: null, count: 0, error: null }),
    }),
  };
  const milestoneChain = {
    from: () => milestoneChain,
    select: () => milestoneChain,
    eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
  };

  let callIndex = 0;
  const builder = {
    from: (table: string) => {
      if (table === "emotional_sessions") {
        return callIndex++ === 0 ? firstSessionChain : countChain;
      }
      if (table === "user_healing_milestones") {
        return milestoneChain;
      }
      return firstSessionChain;
    },
  };
  return builder as unknown as SupabaseClient;
}

describe("secondAwakening", () => {
  describe("getSecondAwakening", () => {
    it("returns not eligible when no sessions and no milestone", async () => {
      const supabase = mockSupabaseNotEligible();
      const result = await getSecondAwakening(supabase, "user-1");
      expect(result.eligible).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.userDay).toBe(0);
      expect(result.sessionCount).toBe(0);
      expect(result.ritual).toBeUndefined();
    });
  });
});
