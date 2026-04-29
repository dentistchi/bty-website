import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [] }),
}));

const mockRequireUser = vi.fn();
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
}));

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock("@/lib/bty/pattern-engine/syncPatternStates", () => ({
  syncPatternStatesForUser: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/bty/pattern-engine/resolvePatternFamilyForContractTrigger", () => ({
  resolvePatternFamilyForContractTrigger: vi.fn().mockResolvedValue("ownership_escape"),
}));

const mockEnsureActionContractForArenaRun = vi.fn();
vi.mock("@/lib/bty/action-contract/ensureActionContractForArenaRun", () => ({
  ensureActionContractForArenaRun: (...args: unknown[]) =>
    mockEnsureActionContractForArenaRun(...args),
}));

const mockApplyDirectCoreXp = vi.fn();
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: (...args: unknown[]) => mockApplyDirectCoreXp(...args),
  applySeasonalXpToCore: vi.fn().mockResolvedValue({ coreGain: 0, newCoreTotal: 0 }),
}));

vi.mock("@/lib/bty/arena/activityXp", () => ({
  getArenaTodayTotal: vi.fn().mockResolvedValue(0),
  capArenaDailyDelta: vi.fn((xp: number) => xp),
  ARENA_DAILY_XP_CAP: 999,
}));
vi.mock("@/lib/bty/arena/arenaLabXp", () => ({
  getDifficultyBase: vi.fn().mockReturnValue(40),
  computeArenaCoreXp: vi.fn().mockReturnValue(21),
  computeArenaWeeklyXp: vi.fn().mockReturnValue(13),
  streakFactorFromDays: vi.fn().mockReturnValue(0),
  inferDifficultyFromEventSum: vi.fn().mockReturnValue("mid"),
  parseStoredDifficulty: vi.fn((v: unknown) => (typeof v === "string" ? v : "mid")),
  timeFactorFromRemaining: vi.fn().mockReturnValue(0),
}));

vi.mock("@/lib/bty/action-contract/actionContractLifecycle.server", () => ({
  completeArenaRunAfterContractVerification: vi
    .fn()
    .mockResolvedValue({ runUpdated: true, deferredQueued: false }),
}));
vi.mock("@/lib/bty/level-engine/arenaLevelRecords", () => ({
  onArenaRunCompleteVerified: vi.fn().mockResolvedValue({ ok: true, bandChanged: false }),
}));

const mockComputeReexposureValidation = vi.fn();
vi.mock("@/lib/bty/arena/reexposureValidation.server", () => ({
  computeReexposureValidation: (...args: unknown[]) =>
    mockComputeReexposureValidation(...args),
}));
vi.mock("@/engine/scenario/delayed-outcome-trigger.service", () => ({
  markDueOutcomesDelivered: vi.fn().mockResolvedValue(undefined),
}));
const mockInsertReinforcementDelayedOutcome = vi.fn();
vi.mock("@/lib/bty/arena/reinforcementLoopSchedule.server", () => ({
  loopIterationForPendingRow: vi.fn(() => 1),
  insertReinforcementDelayedOutcome: (...args: unknown[]) =>
    mockInsertReinforcementDelayedOutcome(...args),
}));
vi.mock("@/lib/bty/arena/patternSignatureUpsert.server", () => ({
  upsertUserPatternSignatureFromValidation: vi.fn().mockResolvedValue({ ok: true }),
}));

const adminFrom = vi.fn();
let adminRpc: (() => Promise<{ error: null }>) | null = null;
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: adminFrom,
    rpc: () => (adminRpc ? adminRpc() : Promise.resolve({ error: null })),
  })),
}));

type Row = Record<string, unknown>;
function createSupabaseState() {
  const state = {
    arenaRuns: [
      {
        run_id: "run1",
        user_id: "u1",
        status: "IN_PROGRESS",
        scenario_id: "sc1",
        difficulty: "mid",
        meta: { time_limit: 120, time_remaining: 60 },
      },
    ] as Row[],
    arenaEvents: [
      { event_id: "ev-choice", user_id: "u1", run_id: "run1", event_type: "CHOICE", xp: 60, scenario_id: "sc1" },
    ] as Row[],
    weeklyXp: [{ id: "wx1", user_id: "u1", league_id: null, xp_total: 100 }] as Row[],
    arenaProfiles: [
      {
        user_id: "u1",
        streak: 0,
        core_xp_total: 200,
        core_xp_buffer: 0,
        sub_name: "Spark",
        sub_name_renamed_in_code: false,
      },
    ] as Row[],
    contracts: [
      {
        id: "c1",
        user_id: "u1",
        session_id: "run1",
        run_id: "run1",
        arena_scenario_id: "sc1",
        status: "submitted",
        validation_approved_at: new Date().toISOString(),
        verified_at: null,
        le_activation_type: "micro_win",
        weight: 1,
        chosen_at: new Date().toISOString(),
        deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    ] as Row[],
    pendingOutcomes: [
      { id: "po1", user_id: "u1", status: "pending", source_choice_history_id: "h1", reinforcement_loop: null },
    ] as Row[],
    choiceHistory: [{ id: "h1", user_id: "u1", scenario_id: "sc1" }] as Row[],
    leActivationLog: [] as Row[],
    leVerificationLog: [] as Row[],
  };

  const makeBuilder = (table: string) => {
    let filters: Record<string, unknown> = {};
    const self = {
      select: (_cols?: string, _opts?: unknown) => self,
      eq: (k: string, v: unknown) => {
        filters[k] = v;
        return self;
      },
      in: (_k: string, _v: unknown[]) => self,
      not: (_k: string, _o: string, _v: unknown) => self,
      is: (_k: string, _v: unknown) => self,
      gte: (_k: string, _v: unknown) => self,
      limit: (_n: number) => self,
      order: (_k: string, _o?: unknown) => self,
      maybeSingle: async () => {
        if (table === "arena_runs") {
          const row = state.arenaRuns.find(
            (r) =>
              (!filters.run_id || r.run_id === filters.run_id) &&
              (!filters.user_id || r.user_id === filters.user_id),
          );
          return { data: row ?? null, error: null };
        }
        if (table === "arena_profiles") {
          const row = state.arenaProfiles.find((r) => r.user_id === filters.user_id);
          return { data: row ?? null, error: null };
        }
        if (table === "weekly_xp") {
          const row = state.weeklyXp.find((r) => r.user_id === filters.user_id);
          return { data: row ?? null, error: null };
        }
        if (table === "bty_action_contracts") {
          const row = state.contracts.find(
            (r) =>
              (!filters.id || r.id === filters.id) &&
              (!filters.user_id || r.user_id === filters.user_id) &&
              (!filters.session_id || r.session_id === filters.session_id),
          );
          return { data: row ?? null, error: null };
        }
        if (table === "arena_pending_outcomes") {
          const row = state.pendingOutcomes.find(
            (r) =>
              (!filters.id || r.id === filters.id) &&
              (!filters.user_id || r.user_id === filters.user_id),
          );
          return { data: row ?? null, error: null };
        }
        if (table === "user_scenario_choice_history") {
          const row = state.choiceHistory.find(
            (r) =>
              (!filters.id || r.id === filters.id) &&
              (!filters.user_id || r.user_id === filters.user_id),
          );
          return { data: row ?? null, error: null };
        }
        if (table === "le_activation_log") {
          const row = state.leActivationLog.find(
            (r) =>
              (!filters.user_id || r.user_id === filters.user_id) &&
              (!filters.session_id || r.session_id === filters.session_id),
          );
          return { data: row ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === "le_activation_log") {
          const row = state.leActivationLog[state.leActivationLog.length - 1] ?? null;
          return { data: row, error: null };
        }
        return { data: null, error: null };
      },
      then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => {
        if (table === "arena_events" && filters.event_type === "RUN_COMPLETED_APPLIED") {
          const data = state.arenaEvents.filter(
            (e) =>
              e.user_id === filters.user_id &&
              e.run_id === filters.run_id &&
              e.event_type === "RUN_COMPLETED_APPLIED",
          );
          return Promise.resolve({ data, error: null }).then(ok, fail);
        }
        if (table === "arena_events") {
          const data = state.arenaEvents.filter(
            (e) => e.user_id === filters.user_id && e.run_id === filters.run_id,
          );
          return Promise.resolve({ data, error: null }).then(ok, fail);
        }
        return Promise.resolve({ data: [], count: 0, error: null }).then(ok, fail);
      },
      update: (patch: Record<string, unknown>) => {
        const updater = {
          eq: (k: string, v: unknown) => {
            filters[k] = v;
            if (table === "arena_runs") {
              state.arenaRuns = state.arenaRuns.map((r) =>
                r.run_id === filters.run_id && r.user_id === filters.user_id
                  ? { ...r, ...patch }
                  : r,
              );
            }
            if (table === "weekly_xp") {
              state.weeklyXp = state.weeklyXp.map((r) =>
                r.id === filters.id ? { ...r, ...patch } : r,
              );
            }
            if (table === "bty_action_contracts") {
              state.contracts = state.contracts.map((r) =>
                r.id === filters.id && r.user_id === filters.user_id
                  ? { ...r, ...patch }
                  : r,
              );
            }
            if (table === "arena_pending_outcomes") {
              state.pendingOutcomes = state.pendingOutcomes.map((r) =>
                r.id === filters.id && r.user_id === filters.user_id
                  ? { ...r, ...patch }
                  : r,
              );
            }
            if (table === "le_activation_log") {
              state.leActivationLog = state.leActivationLog.map((r) =>
                r.activation_id === filters.activation_id && r.user_id === filters.user_id
                  ? { ...r, ...patch }
                  : r,
              );
            }
            return updater;
          },
          in: (_k: string, _v: unknown[]) => updater,
          not: (_k: string, _o: string, _v: unknown) => updater,
          is: async (_k: string, _v: unknown) => ({ error: null }),
        };
        return updater;
      },
      insert: (row: Record<string, unknown>) => {
        if (table === "arena_events") {
          state.arenaEvents.push(row);
        }
        if (table === "le_activation_log") {
          const inserted = { ...row, activation_id: "act-loop-1" };
          state.leActivationLog.push(inserted);
        }
        if (table === "le_verification_log") {
          state.leVerificationLog.push(row);
        }
        return self;
      },
    };
    return self;
  };

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc: async () => ({ error: null }),
    from: (table: string) => makeBuilder(table),
  };
  return { state, client };
}

describe("canonical reward loop integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret-validate");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    vi.stubEnv("BTY_ALLOW_LEGACY_PENDING_QR_APPROVE", "false");
  });

  it("run/complete -> qr/validate -> re-exposure/validate follows canonical reward loop", async () => {
    const { state, client } = createSupabaseState();
    mockGetSupabaseServerClient.mockResolvedValue(client);
    mockGetSupabaseAdmin.mockReturnValue(client as never);
    adminFrom.mockImplementation((table: string) => client.from(table));
    adminRpc = async () => ({ error: null });
    mockEnsureActionContractForArenaRun.mockResolvedValue({
      ok: true,
      created: true,
      contractId: "c1",
    });
    mockApplyDirectCoreXp.mockImplementation(
      async (_supabase, userId: string, coreGain: number) => {
        state.arenaProfiles = state.arenaProfiles.map((r) =>
          r.user_id === userId
            ? { ...r, core_xp_total: Number(r.core_xp_total ?? 0) + coreGain }
            : r,
        );
        return { newCoreTotal: Number(state.arenaProfiles[0]?.core_xp_total ?? 0) };
      },
    );

    const { POST: runCompletePOST } = await import("@/app/api/arena/run/complete/route");
    const { POST: qrValidatePOST } = await import("@/app/api/arena/leadership-engine/qr/validate/route");
    const { POST: reexposurePOST } = await import("@/app/api/arena/re-exposure/validate/route");

    // 1) run/complete with Action Contract present -> deferred reward
    const runRes = await runCompletePOST(
      new Request("http://localhost/api/arena/run/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: "run1" }),
      }),
    );
    expect(runRes.status).toBe(200);
    const runBody = await runRes.json();
    expect(runBody.xpDeferredToContractVerification).toBe(true);
    expect(runBody.coreXp).toBe(0);
    expect(runBody.weeklyXp).toBe(0);

    // 2) qr/validate -> deferred run rewards + AIR reflection writes
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "u1",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const qrRes = await qrValidatePOST(
      new NextRequest("http://localhost/api/arena/leadership-engine/qr/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ arenaActionLoopToken: token }),
      }),
    );
    expect(qrRes.status).toBe(200);
    expect(mockApplyDirectCoreXp).toHaveBeenCalledWith(expect.anything(), "u1", 21);
    const weeklyAfterQr = state.weeklyXp.find((r) => r.user_id === "u1");
    expect(Number(weeklyAfterQr?.xp_total ?? 0)).toBe(113);
    expect(state.leActivationLog.length).toBeGreaterThan(0);
    expect(state.leVerificationLog.length).toBeGreaterThan(0);

    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase: client, base: new Response() });

    // 3a) re-exposure changed -> positive reflection
    mockComputeReexposureValidation.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: "sc1",
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit",
        before_exit_pattern_key: "x",
        action_decision_commitment: "commit",
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "truth_naming",
        after_second_choice_direction: "entry",
        after_exit_pattern_key: "y",
        validation_result: "changed",
        axis_guard: "same_axis_ok",
        prior_run_id: "r0",
        reexposure_run_id: "run1",
        recorded_at: new Date().toISOString(),
      },
    });
    const changedRes = await reexposurePOST(
      new NextRequest("http://localhost/api/arena/re-exposure/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingOutcomeId: "po1", runId: "run1", scenarioId: "sc1" }),
      }),
    );
    const changedBody = await changedRes.json();
    expect(changedBody.reflection.core_xp).toBe(12);
    expect(changedBody.reflection.weekly_xp).toBe(8);

    // reset pending row for next branch probes
    state.pendingOutcomes[0] = {
      ...state.pendingOutcomes[0],
      status: "pending",
      validation_payload: null,
      reinforcement_loop: null,
    };

    // 3b) unstable -> partial reward + follow-up scheduling
    mockInsertReinforcementDelayedOutcome.mockResolvedValueOnce({
      ok: true,
      newPendingId: "po2",
      next_scheduled_for: "2026-05-01T00:00:00.000Z",
    });
    mockComputeReexposureValidation.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: "sc1",
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit",
        before_exit_pattern_key: "x",
        action_decision_commitment: "commit",
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit",
        after_exit_pattern_key: "z",
        validation_result: "unstable",
        axis_guard: "same_axis_ok",
        prior_run_id: "r0",
        reexposure_run_id: "run1",
        recorded_at: new Date().toISOString(),
      },
    });
    const unstableRes = await reexposurePOST(
      new NextRequest("http://localhost/api/arena/re-exposure/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingOutcomeId: "po1", runId: "run1", scenarioId: "sc1" }),
      }),
    );
    const unstableBody = await unstableRes.json();
    expect(unstableBody.follow_up_scheduled).toBe(true);
    expect(unstableBody.reflection.core_xp).toBe(5);
    expect(unstableBody.reflection.weekly_xp).toBe(3);

    state.pendingOutcomes[0] = {
      ...state.pendingOutcomes[0],
      status: "pending",
      validation_payload: null,
      reinforcement_loop: null,
    };

    // 3c) no_change -> follow-up + weekly +1 / core +0
    mockInsertReinforcementDelayedOutcome.mockResolvedValueOnce({
      ok: true,
      newPendingId: "po3",
      next_scheduled_for: "2026-05-03T00:00:00.000Z",
    });
    mockComputeReexposureValidation.mockResolvedValueOnce({
      ok: true,
      payload: {
        scenario_id: "sc1",
        before_axis: "Blame vs. Structural Honesty",
        before_pattern_family: "blame_shift",
        before_second_choice_direction: "exit",
        before_exit_pattern_key: "x",
        action_decision_commitment: "commit",
        after_axis: "Blame vs. Structural Honesty",
        after_pattern_family: "blame_shift",
        after_second_choice_direction: "exit",
        after_exit_pattern_key: "x",
        validation_result: "no_change",
        axis_guard: "same_axis_ok",
        prior_run_id: "r0",
        reexposure_run_id: "run1",
        recorded_at: new Date().toISOString(),
      },
    });
    const noChangeRes = await reexposurePOST(
      new NextRequest("http://localhost/api/arena/re-exposure/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingOutcomeId: "po1", runId: "run1", scenarioId: "sc1" }),
      }),
    );
    const noChangeBody = await noChangeRes.json();
    expect(noChangeBody.follow_up_scheduled).toBe(true);
    expect(noChangeBody.reflection.core_xp).toBe(0);
    expect(noChangeBody.reflection.weekly_xp).toBe(1);
  });
});
