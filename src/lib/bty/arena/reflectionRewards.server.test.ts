/**
 * Re-exposure reflection rewards — `result_origin` gating (Route B governance).
 *
 * Proves: an `insufficient_signal` (fallback collapse) result grants no validation XP
 * and is logged as NOT verified; a `computed` band keeps its existing reward profile;
 * and (§5.3) the le_activation_log row preserves `result_origin` so a fallback
 * activation is distinguishable from a genuine computed micro_win.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  applyArenaRunRewardsOnVerifiedCompletion,
  applyReexposureOutcomeReflection,
} from "./reflectionRewards.server";

const privateWriter = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => privateWriter.client }));

vi.mock("@/engine/avatar/avatar-state.service", () => ({ syncAvatarStateAfterCoreXpChange: vi.fn(async () => undefined) }));
const AWARD = { policyVersion: "shared-xp/v2", weeklyXpTotal: 8, coreBefore: 0, coreAfter: 12, coreGain: 12, coreBufferAfter: 0 };
const privateResult = vi.hoisted(() => ({ value: null as null | { data: unknown; error: unknown } }));
function privateReply(fn: string) {
  if (privateResult.value) return privateResult.value;
  if (fn === "bty_apply_arena_run_rewards_v2") return { data: { ...AWARD, applied: true, weeklyXp: 8, coreXp: 12 }, error: null };
  if (fn === "bty_award_xp_v2") return { data: AWARD, error: null };
  return { data: null, error: null };
}

// STAB-02-P1: deterministic XP values for applyArenaRunRewardsOnVerifiedCompletion
// tests. Default returns positive coreXp / weeklyXp; individual tests override
// (e.g., set computeArenaCoreXp to 0 to exercise the zero-gain ledger skip).
vi.mock("@/lib/bty/arena/arenaLabXp", () => ({
  getDifficultyBase: vi.fn(() => 12),
  computeArenaCoreXp: vi.fn(() => 12),
  computeArenaWeeklyXp: vi.fn(() => 8),
  streakFactorFromDays: vi.fn(() => 0),
  inferDifficultyFromEventSum: vi.fn(() => "BEGINNER"),
  parseStoredDifficulty: vi.fn(() => null),
  timeFactorFromRemaining: vi.fn(() => 0),
}));

vi.mock("@/lib/bty/arena/activityXp", () => ({
  getArenaTodayTotal: vi.fn(async () => 0),
  capArenaDailyDelta: vi.fn((delta: number) => delta),
}));

type Captures = Record<string, Record<string, unknown>[]>;

function makeSupabase(): { supabase: unknown; captures: Captures } {
  const captures: Captures = {};
  const supabase = {
    from(table: string) {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        is: () => api,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: (payload: Record<string, unknown>) => {
          (captures[table] ??= []).push(payload);
          return {
            select: () => ({
              single: async () => ({
                data: { activation_id: "act-1" },
                error: null,
              }),
            }),
            then: (res: (v: { error: null }) => unknown, rej?: (e: unknown) => unknown) =>
              Promise.resolve({ error: null }).then(res, rej),
          };
        },
      };
      return api;
    },
    // Reward writes route through the service-role atomic RPCs only.
    rpc: (fn: string, args?: Record<string, unknown>) => {
      (captures.__rpc ??= []).push({ fn, ...(args ?? {}) });
      if (fn.startsWith("bty_award_") || fn.startsWith("increment_")) throw new Error("privileged RPC used the user client");
      return Promise.resolve({ data: null, error: null });
    },
  };
  privateWriter.client = { rpc: (fn: string, args?: Record<string, unknown>) => {
    (captures.__privateRpc ??= []).push({ fn, ...(args ?? {}) });
    return Promise.resolve(privateReply(fn));
  } };
  return { supabase, captures };
}

// STAB-02-P1: builder for applyArenaRunRewardsOnVerifiedCompletion path.
// Supports the chain shapes used at L60–134 of reflectionRewards.server.ts.
type ArenaRunCaptures = {
  inserts: Record<string, Record<string, unknown>[]>;
  rpc: { fn: string; args?: Record<string, unknown> }[];
  privateRpc: { fn: string; args?: Record<string, unknown> }[];
};

function makeArenaRunSupabase(options?: {
  runCompletedAppliedRows?: { event_id: string }[];
  arenaEventXpRows?: { xp: number }[];
  profileStreak?: number | null;
  coreXpLedgerInsertError?: { code?: string; message?: string } | null;
}): { supabase: unknown; captures: ArenaRunCaptures } {
  const runCompletedAppliedRows = options?.runCompletedAppliedRows ?? [];
  const arenaEventXpRows = options?.arenaEventXpRows ?? [];
  const profileStreak = options?.profileStreak ?? null;
  const coreXpLedgerInsertError = options?.coreXpLedgerInsertError ?? null;

  const captures: ArenaRunCaptures = { inserts: {}, rpc: [], privateRpc: [] };

  function arenaEventsSelectQuery() {
    // The function makes two SELECT queries against arena_events:
    //   1) event_id WHERE event_type='RUN_COMPLETED_APPLIED' LIMIT 1
    //   2) xp WHERE user_id=? AND run_id=?
    // The first call lands first because of order in source.
    let select1 = true;
    const chain: Record<string, unknown> = {
      select: (_cols: string) => chain,
      eq: () => chain,
      limit: () => chain,
      then: (
        resolve: (v: { data: unknown[]; error: null }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        const data = select1 ? runCompletedAppliedRows : arenaEventXpRows;
        select1 = false;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return chain;
  }

  let arenaEventsChain: ReturnType<typeof arenaEventsSelectQuery> | null = null;

  const supabase = {
    from(table: string) {
      if (table === "arena_events") {
        // Stateful chain: SELECT then SELECT then INSERT all use the same .from
        // sequence. The chain object distinguishes by whether .insert is called.
        if (!arenaEventsChain) arenaEventsChain = arenaEventsSelectQuery();
        const ch = arenaEventsChain as Record<string, unknown>;
        ch.insert = (payload: Record<string, unknown>) => {
          (captures.inserts.arena_events ??= []).push(payload);
          return Promise.resolve({ error: null });
        };
        return ch;
      }
      if (table === "arena_profiles") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: profileStreak == null ? null : { streak: profileStreak },
            error: null,
          }),
        };
        return chain;
      }
      if (table === "core_xp_ledger") {
        const chain: Record<string, unknown> = {
          insert: (payload: Record<string, unknown>) => {
            (captures.inserts.core_xp_ledger ??= []).push(payload);
            return Promise.resolve({
              error: coreXpLedgerInsertError,
            });
          },
        };
        return chain;
      }
      // Unknown table — return a chain that resolves benignly.
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        insert: () => Promise.resolve({ error: null }),
      };
      return chain;
    },
    rpc: (fn: string, args?: Record<string, unknown>) => {
      captures.rpc.push({ fn, args });
      if (fn.startsWith("bty_") || fn.startsWith("increment_")) throw new Error("privileged RPC used the user client");
      return Promise.resolve({ data: null, error: null });
    },
  };
  privateWriter.client = { rpc: (fn: string, args?: Record<string, unknown>) => {
    captures.privateRpc.push({ fn, args });
    return Promise.resolve(privateReply(fn));
  } };
  return { supabase, captures };
}

describe("applyArenaRunRewardsOnVerifiedCompletion — one atomic reward transaction", () => {
  afterEach(() => {
    privateResult.value = null;
    vi.clearAllMocks();
  });

  it("commits the anchor, weekly XP, Core and ARENA ledger through one service RPC", async () => {
    const { supabase, captures } = makeArenaRunSupabase();
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-A", scenario_id: "core_01" },
    });
    expect(result).toMatchObject({ ok: true, applied: true, coreXp: 12, weeklyXp: 8 });
    expect(captures.privateRpc).toEqual([{ fn: "bty_apply_arena_run_rewards_v2", args: {
      p_user_id: "user-stab02", p_run_id: "run-stab02-A", p_scenario_id: "core_01", p_weekly_delta: 8, p_core_xp: 12 } }]);
    // No split writes: neither the RUN_COMPLETED_APPLIED anchor nor the ledger row is written directly.
    expect(captures.inserts.arena_events).toBeUndefined();
    expect(captures.inserts.core_xp_ledger).toBeUndefined();
    expect(captures.rpc).toEqual([]);
  });

  it("passes a zero Core gain to the RPC, which then writes no ledger row", async () => {
    const arenaLabXp = await import("@/lib/bty/arena/arenaLabXp");
    vi.mocked(arenaLabXp.computeArenaCoreXp).mockReturnValueOnce(0);
    const { supabase, captures } = makeArenaRunSupabase();
    await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-Z", scenario_id: "core_01" },
    });
    expect(captures.privateRpc[0]?.args).toMatchObject({ p_core_xp: 0, p_weekly_delta: 8 });
    expect(captures.inserts.core_xp_ledger).toBeUndefined();
  });

  it("reports a run already rewarded by a concurrent completion without paying", async () => {
    privateResult.value = { data: { policyVersion: "shared-xp/v2", applied: false }, error: null };
    const { supabase } = makeArenaRunSupabase();
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-DUP", scenario_id: "core_01" },
    });
    expect(result).toEqual({ ok: true, applied: false, coreXp: 0, weeklyXp: 0, deltaApplied: 0 });
  });

  it("returns the failure when the atomic RPC fails; nothing was committed", async () => {
    privateResult.value = { data: null, error: { code: "P0001", message: "REWARD_WRITES_PAUSED" } };
    const { supabase, captures } = makeArenaRunSupabase();
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-ERR", scenario_id: "core_01" },
    });
    expect(result).toEqual({ ok: false, error: "REWARD_WRITES_PAUSED" });
    expect(captures.inserts.arena_events).toBeUndefined();
  });
});

describe("applyReexposureOutcomeReflection — result_origin gating", () => {
  it("insufficient_signal: no validation XP, verified=false", async () => {
    const { supabase, captures } = makeSupabase();
    const result = await applyReexposureOutcomeReflection({
      supabase: supabase as never,
      userId: "u1",
      runId: "run-1",
      scenarioId: "core_01",
      validationResult: "unstable",
      resultOrigin: "insufficient_signal",
    });
    expect(result).toMatchObject({ ok: true, coreXp: 0, weeklyXp: 0 });
    // weeklyXp 0 → upsert skipped entirely (weekly_xp untouched, no increment RPC)
    expect(captures.weekly_xp).toBeUndefined();
    expect((captures.__rpc ?? []).some((c) => c.fn === "increment_weekly_xp")).toBe(false);
    expect(captures.__privateRpc ?? []).toEqual([]);
    // the validation event is still logged, but not as verified evidence
    expect(captures.le_verification_log?.[0]?.verified).toBe(false);
    expect(captures.arena_events?.[0]?.xp).toBe(0);
    // §5.3: the activation row preserves result_origin (no representation collapse)
    expect(captures.le_activation_log?.[0]?.result_origin).toBe("insufficient_signal");
  });

  it("computed unstable: keeps reward profile (5 core / 3 weekly, verified)", async () => {
    const { supabase, captures } = makeSupabase();
    const result = await applyReexposureOutcomeReflection({
      supabase: supabase as never,
      userId: "u1",
      runId: "run-1",
      scenarioId: "core_01",
      validationResult: "unstable",
      resultOrigin: "computed",
    });
    expect(result).toMatchObject({ ok: true, coreXp: 5, weeklyXp: 3 });
    // Weekly XP and direct Core commit together in one locked service RPC.
    expect(captures.weekly_xp).toBeUndefined();
    expect(captures.__privateRpc).toEqual([{
      fn: "bty_award_xp_v2", p_user_id: "u1", p_league_id: null,
      p_weekly_delta: 3, p_seasonal_core_xp: 0, p_direct_core_xp: 5,
    }]);
    expect((captures.__rpc ?? []).some(call => String(call.fn).startsWith("bty_award_"))).toBe(false);
    expect(captures.le_verification_log?.[0]?.verified).toBe(true);
    expect(captures.arena_events?.[0]?.xp).toBe(3);
    // §5.3: a computed activation is tagged distinctly from a fallback
    expect(captures.le_activation_log?.[0]?.result_origin).toBe("computed");
  });
});
