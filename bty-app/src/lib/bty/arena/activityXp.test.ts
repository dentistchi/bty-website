/**
 * Unit tests for activity XP recording (Foundry/Center).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Hermetic: keep recordActivityXp off the real DB. getActiveLeague + admin client
// are stubbed so the test never opens a network/DB connection.
vi.mock("./activeLeague", () => ({ getActiveLeague: vi.fn(async () => null) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: vi.fn(() => null) }));
vi.mock("./applyCoreXp", () => ({
  applySeasonalXpToCore: vi.fn(async () => ({ coreGain: 0, newCoreTotal: 0 })),
}));

import { recordActivityXp, capArenaDailyDelta, ARENA_DAILY_XP_CAP, type ActivityType } from "./activityXp";

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

  describe("capArenaDailyDelta", () => {
    it("caps delta to remaining room below daily cap", () => {
      expect(capArenaDailyDelta(100, ARENA_DAILY_XP_CAP - 50)).toBe(50);
      expect(capArenaDailyDelta(500, 0)).toBe(500);
      expect(capArenaDailyDelta(1000, ARENA_DAILY_XP_CAP)).toBe(0);
    });
  });

  /**
   * Atomic weekly_xp increment regression guard (pre-demo lost-write hotfix).
   * recordActivityXp must route the weekly_xp write through the increment_weekly_xp
   * RPC (single atomic UPSERT) and must NOT do a weekly_xp select-then-update
   * (the read-modify-write pattern that lost writes under concurrency).
   */
  describe("recordActivityXp — atomic weekly_xp increment", () => {
    function atomicMock() {
      const rpcCalls: Array<{ fn: string; args: unknown }> = [];
      const weeklyXpDirectWrites: string[] = [];
      const make = (table: string) => {
        const node: Record<string, unknown> = {};
        for (const f of ["select", "eq", "gte", "lte", "gt", "is", "in", "not", "order", "limit", "update", "insert", "delete"]) {
          node[f] = (..._a: unknown[]) => {
            if ((f === "update" || f === "insert" || f === "delete") && table === "weekly_xp") {
              weeklyXpDirectWrites.push(f);
            }
            return node;
          };
        }
        node.maybeSingle = () =>
          Promise.resolve(
            table === "arena_profiles"
              ? { data: { core_xp_total: 0, core_xp_buffer: 0, sub_name: "Spark", sub_name_renamed_in_code: false }, error: null }
              : { data: null, error: null },
          );
        // Make every chain node awaitable: resolves to an empty result set.
        node.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
        return node;
      };
      const supabase = {
        from: (t: string) => make(t),
        rpc: (fn: string, args?: unknown) => {
          rpcCalls.push({ fn, args });
          return Promise.resolve({ data: null, error: null });
        },
      } as unknown as SupabaseClient;
      return { supabase, rpcCalls, weeklyXpDirectWrites };
    }

    it("calls increment_weekly_xp RPC with the capped delta and no direct weekly_xp write", async () => {
      const { supabase, rpcCalls, weeklyXpDirectWrites } = atomicMock();
      const result = await recordActivityXp(supabase, "user-1", "MENTOR_MESSAGE");

      expect(result).toEqual({ ok: true, xp: 5 });
      const incr = rpcCalls.find((c) => c.fn === "increment_weekly_xp");
      expect(incr).toBeDefined();
      expect(incr?.args).toEqual({ p_user_id: "user-1", p_league_id: null, p_delta: 5 });
      // The read-modify-write path is gone: no weekly_xp update/insert/delete.
      expect(weeklyXpDirectWrites).toEqual([]);
    });

    it("returns ok false when the increment RPC errors", async () => {
      const { supabase } = atomicMock();
      (supabase as unknown as { rpc: unknown }).rpc = (fn: string) =>
        fn === "increment_weekly_xp"
          ? Promise.resolve({ data: null, error: { message: "rpc_failed" } })
          : Promise.resolve({ data: null, error: null });
      const result = await recordActivityXp(supabase, "user-1", "CHAT_MESSAGE");
      expect(result).toEqual({ ok: false, error: "rpc_failed" });
    });
  });
});
