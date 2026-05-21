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

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ ok: true, newCoreTotal: 12 })),
}));

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
    // weekly_xp writes route through the atomic increment_weekly_xp RPC.
    rpc: (fn: string, args?: Record<string, unknown>) => {
      (captures.__rpc ??= []).push({ fn, ...(args ?? {}) });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { supabase, captures };
}

// STAB-02-P1: builder for applyArenaRunRewardsOnVerifiedCompletion path.
// Supports the chain shapes used at L60–134 of reflectionRewards.server.ts.
type ArenaRunCaptures = {
  inserts: Record<string, Record<string, unknown>[]>;
  rpc: { fn: string; args?: Record<string, unknown> }[];
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

  const captures: ArenaRunCaptures = { inserts: {}, rpc: [] };

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
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { supabase, captures };
}

describe("applyArenaRunRewardsOnVerifiedCompletion — STAB-02-P1 core_xp_ledger insert", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("inserts core_xp_ledger row with source_type='ARENA' and source_id=run.run_id when coreGain > 0", async () => {
    const { supabase, captures } = makeArenaRunSupabase();
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-A", scenario_id: "core_01" },
    });
    expect(result).toMatchObject({ ok: true, applied: true, coreXp: 12, weeklyXp: 8 });
    const ledgerInserts = captures.inserts.core_xp_ledger ?? [];
    expect(ledgerInserts).toHaveLength(1);
    expect(ledgerInserts[0]).toEqual({
      user_id: "user-stab02",
      delta_xp: 12,
      source_type: "ARENA",
      source_id: "run-stab02-A",
    });
  });

  it("does NOT insert ledger row when coreGain === 0", async () => {
    const arenaLabXp = await import("@/lib/bty/arena/arenaLabXp");
    vi.mocked(arenaLabXp.computeArenaCoreXp).mockReturnValueOnce(0);
    const { supabase, captures } = makeArenaRunSupabase();
    await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-Z", scenario_id: "core_01" },
    });
    expect(captures.inserts.core_xp_ledger).toBeUndefined();
  });

  it("treats 23505 unique violation as benign (idempotency); no warn", async () => {
    const { supabase, captures } = makeArenaRunSupabase({
      coreXpLedgerInsertError: { code: "23505", message: "duplicate key value" },
    });
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-DUP", scenario_id: "core_01" },
    });
    expect(result).toMatchObject({ ok: true, applied: true });
    expect(captures.inserts.core_xp_ledger).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs warning but does NOT throw on non-23505 ledger error", async () => {
    const { supabase, captures } = makeArenaRunSupabase({
      coreXpLedgerInsertError: { code: "23502", message: "null value violates NOT NULL" },
    });
    const result = await applyArenaRunRewardsOnVerifiedCompletion({
      supabase: supabase as never,
      userId: "user-stab02",
      run: { run_id: "run-stab02-ERR", scenario_id: "core_01" },
    });
    expect(result).toMatchObject({ ok: true, applied: true });
    expect(captures.inserts.core_xp_ledger).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("core_xp_ledger insert non-fatal failure");
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
    // weekly_xp write goes through the atomic increment_weekly_xp RPC, not a
    // read-modify-write select+update.
    expect(captures.weekly_xp).toBeUndefined();
    expect(captures.__rpc?.find((c) => c.fn === "increment_weekly_xp")).toEqual({
      fn: "increment_weekly_xp",
      p_user_id: "u1",
      p_league_id: null,
      p_delta: 3,
    });
    expect(captures.le_verification_log?.[0]?.verified).toBe(true);
    expect(captures.arena_events?.[0]?.xp).toBe(3);
    // §5.3: a computed activation is tagged distinctly from a fallback
    expect(captures.le_activation_log?.[0]?.result_origin).toBe("computed");
  });
});
