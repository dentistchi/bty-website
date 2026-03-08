/**
 * Unit tests for activity XP recording (Foundry/Center).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect } from "vitest";
import { recordActivityXp, type ActivityType } from "./activityXp";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(opts: {
  arenaToday?: number;
  activityToday?: number;
  insertError?: string | null;
}) {
  const { arenaToday = 0, activityToday = 0, insertError = null } = opts;
  const chain = {
    from: (table: string) => {
      if (table === "arena_events") {
        return {
          select: () => ({
            eq: () => ({ gte: () => Promise.resolve({ data: arenaToday ? [{ xp: arenaToday }] : [], error: null }) }),
          }),
        };
      }
      if (table === "activity_xp_events") {
        return {
          select: () => ({
            eq: () => ({
              gte: () =>
                Promise.resolve({
                  data: activityToday ? [{ xp: activityToday }] : [],
                  error: null,
                }),
            }),
          }),
          insert: () =>
            insertError
              ? Promise.resolve({ error: { message: insertError }, data: null })
              : Promise.resolve({ error: null, data: {} }),
        };
      }
      return chain;
    },
    rpc: () => Promise.resolve(),
  };
  return chain as unknown as SupabaseClient;
}

describe("activityXp", () => {
  describe("ActivityType", () => {
    it("accepts MENTOR_MESSAGE and CHAT_MESSAGE", () => {
      const a: ActivityType = "MENTOR_MESSAGE";
      const b: ActivityType = "CHAT_MESSAGE";
      expect(a).toBe("MENTOR_MESSAGE");
      expect(b).toBe("CHAT_MESSAGE");
    });
  });

  describe("recordActivityXp", () => {
    it("returns ok true xp 0 when daily cap already reached", async () => {
      const supabase = mockSupabase({ arenaToday: 1200, activityToday: 0 });
      const result = await recordActivityXp(supabase, "user-1", "MENTOR_MESSAGE");
      expect(result).toEqual({ ok: true, xp: 0 });
    });

    it("returns ok true xp 0 when activity today fills cap", async () => {
      const supabase = mockSupabase({ arenaToday: 0, activityToday: 1200 });
      const result = await recordActivityXp(supabase, "user-1", "CHAT_MESSAGE");
      expect(result).toEqual({ ok: true, xp: 0 });
    });

    it("returns ok false when insert fails", async () => {
      const supabase = mockSupabase({
        arenaToday: 0,
        activityToday: 0,
        insertError: "insert_failed",
      });
      const result = await recordActivityXp(supabase, "user-1", "MENTOR_MESSAGE");
      expect(result).toEqual({ ok: false, error: "insert_failed" });
    });
  });
});
