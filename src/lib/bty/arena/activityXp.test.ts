/**
 * Unit tests for activity XP recording (Foundry/Center).
 * Uses mocked Supabase; no business/XP logic change.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Hermetic: keep recordActivityXp off the real DB. getActiveLeague + admin client
// are stubbed so the test never opens a network/DB connection.
vi.mock("./activeLeague", () => ({ getActiveLeague: vi.fn(async () => null) }));
const privateWriter = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => privateWriter.client }));
beforeEach(() => {
  privateWriter.client = { rpc: vi.fn(async () => ({ data: null, error: null })) };
});
vi.mock("@/engine/avatar/avatar-state.service", () => ({ syncAvatarStateAfterCoreXpChange: vi.fn(async () => undefined) }));
const AWARD = { policyVersion: "shared-xp/v2", weeklyXpTotal: 5, coreBefore: 0, coreAfter: 0, coreGain: 0, coreBufferAfter: 0.1, xp: 5 };

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

    it("returns ok false when the atomic activity award fails", async () => {
      // The activity event is inserted inside bty_award_activity_xp_v2; its failure pays nothing.
      privateWriter.client = { rpc: vi.fn(async () => ({ data: null, error: { message: "insert_failed" } })) };
      const supabase = mockSupabase({ arenaToday: 0, activityToday: 0 });
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
   * Atomic activity award regression guard. The activity event (cap basis), weekly XP
   * and seasonal Core must be one service-role RPC (bty_award_activity_xp_v2): no
   * direct activity_xp_events/weekly_xp/arena_profiles write and no read-then-write Core.
   */
  describe("recordActivityXp — atomic activity award", () => {
    function atomicMock() {
      const rpcCalls: Array<{ fn: string; args: unknown }> = [];
      const userRpcCalls: Array<{ fn: string; args: unknown }> = [];
      privateWriter.client = { rpc: (fn: string, args?: unknown) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ data: fn === "bty_award_activity_xp_v2" ? AWARD : null, error: null });
      } };
      const weeklyXpDirectWrites: string[] = [];
      const make = (table: string) => {
        const node: Record<string, unknown> = {};
        for (const f of ["select", "eq", "gte", "lte", "gt", "is", "in", "not", "order", "limit", "update", "insert", "delete"]) {
          node[f] = (..._a: unknown[]) => {
            if ((f === "update" || f === "insert" || f === "delete" || f === "upsert")
              && ["weekly_xp", "activity_xp_events", "arena_profiles"].includes(table)) {
              weeklyXpDirectWrites.push(`${table}.${f}`);
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
          userRpcCalls.push({ fn, args });
          if (fn.startsWith("bty_award_") || fn.startsWith("increment_")) throw new Error("privileged RPC used the user client");
          return Promise.resolve({ data: null, error: null });
        },
      } as unknown as SupabaseClient;
      return { supabase, rpcCalls, userRpcCalls, weeklyXpDirectWrites };
    }

    it("calls only bty_award_activity_xp_v2 with the capped delta and writes no table directly", async () => {
      const { supabase, rpcCalls, userRpcCalls, weeklyXpDirectWrites } = atomicMock();
      const result = await recordActivityXp(supabase, "user-1", "MENTOR_MESSAGE");

      expect(result).toEqual({ ok: true, xp: 5 });
      expect(rpcCalls).toEqual([{ fn: "bty_award_activity_xp_v2",
        args: { p_user_id: "user-1", p_activity_type: "MENTOR_MESSAGE", p_delta: 5, p_league_id: null } }]);
      expect(weeklyXpDirectWrites).toEqual([]);
      expect(userRpcCalls).toEqual([]);
    });

    it("returns ok false when the atomic RPC errors", async () => {
      const { supabase } = atomicMock();
      (privateWriter.client as { rpc: unknown }).rpc = (fn: string) =>
        fn === "bty_award_activity_xp_v2"
          ? Promise.resolve({ data: null, error: { message: "rpc_failed" } })
          : Promise.resolve({ data: null, error: null });
      const result = await recordActivityXp(supabase, "user-1", "CHAT_MESSAGE");
      expect(result).toEqual({ ok: false, error: "rpc_failed" });
    });
  });
});
