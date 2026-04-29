/**
 * GET /api/arena/n/session — Pipeline N session router (same core as legacy session/next).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetNextScenarioForSession = vi.fn();
const mockFetchBlocking = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/engine/integration/scenario-type-router", () => ({
  getNextScenarioForSession: (...args: unknown[]) => mockGetNextScenarioForSession(...args),
}));

const mockGetArenaPipelineDefault = vi.fn((): "new" | "legacy" => "new");
vi.mock("@/lib/bty/arena/arenaPipelineConfig", () => ({
  getArenaPipelineDefault: () => mockGetArenaPipelineDefault(),
}));

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  fetchBlockingArenaContractForSession: (...args: unknown[]) => mockFetchBlocking(...args),
}));

const mockFetchFirstDueNoChangeReexposureMeta = vi.fn();
vi.mock("@/engine/scenario/delayed-outcome-trigger.service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/engine/scenario/delayed-outcome-trigger.service")>();
  return {
    ...mod,
    fetchFirstDueNoChangeReexposureMeta: (...args: unknown[]) => mockFetchFirstDueNoChangeReexposureMeta(...args),
  };
});

const mockGetLeadershipEngineState = vi.fn();
const mockConsumeDueDelayedOutcomeTriggersForUser = vi.fn();
vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  getLeadershipEngineState: (...args: unknown[]) => mockGetLeadershipEngineState(...args),
}));
vi.mock("@/engine/memory/delayed-outcome-consumer.service", () => ({
  consumeDueDelayedOutcomeTriggersForUser: (...args: unknown[]) =>
    mockConsumeDueDelayedOutcomeTriggersForUser(...args),
}));

function makeSupabaseForSessionRouter() {
  const lte = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateChain = { eq: vi.fn().mockReturnThis(), lte };
  updateChain.eq.mockReturnValue(updateChain);
  const update = vi.fn().mockReturnValue(updateChain);
  const arenaRunsStatusEq = vi.fn().mockResolvedValue({ data: [], error: null });
  const arenaRunsUserIdEq = vi.fn().mockReturnValue({ eq: arenaRunsStatusEq });
  const arenaRunsSelect = vi.fn().mockReturnValue({ eq: arenaRunsUserIdEq });
  const from = vi.fn((table: string) => {
    if (table === "bty_action_contracts") return { update };
    if (table === "arena_runs") return { select: arenaRunsSelect };
    return { select: vi.fn() };
  });
  return { from };
}

describe("GET /api/arena/n/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetArenaPipelineDefault.mockReturnValue("new");
    mockFetchBlocking.mockResolvedValue(null);
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Discover",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
    mockConsumeDueDelayedOutcomeTriggersForUser.mockResolvedValue({
      consumedCount: 0,
      firstTriggerId: null,
      triggers: [],
    });
    mockFetchFirstDueNoChangeReexposureMeta.mockResolvedValue(null);
  });

  it("returns 403 when ARENA_PIPELINE_DEFAULT=legacy", async () => {
    mockGetArenaPipelineDefault.mockReturnValue("legacy");
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("arena_n_session_requires_new_pipeline");
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("returns 200 when new pipeline and no blocking contract", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetNextScenarioForSession).toHaveBeenCalled();
    const data = await res.json();
    expect(data.mode).toBe("arena");
    expect(data.runtime_state).toBe("ARENA_SCENARIO_READY");
    expect(typeof data.state_priority).toBe("number");
    expect(data.gates).toEqual({
      next_allowed: true,
      choice_allowed: true,
      qr_allowed: false,
    });
    expect(data.action_contract?.exists).toBe(false);
    expect(data.scenario?.source).toBe("json");
  });

  it("does not return 409 when blocking row status is submitted", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    mockFetchBlocking.mockResolvedValue({
      id: "c1",
      contract_description: "already submitted",
      deadline_at: new Date(Date.now() + 60_000).toISOString(),
      verification_mode: "qr",
      created_at: new Date().toISOString(),
      status: "submitted",
    });
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.error).not.toBe("action_contract_pending");
    expect(data.runtime_state).toBe("ARENA_SCENARIO_READY");
  });

  it("returns REEXPOSURE_DUE when delayed outcomes pending", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    mockFetchFirstDueNoChangeReexposureMeta.mockResolvedValue({
      scenarioId: "core_01_training_system",
      pendingOutcomeId: "pending-out-1",
    });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: true,
    });
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runtime_state).toBe("REEXPOSURE_DUE");
    expect(data.gates?.choice_allowed).toBe(false);
    expect(data.scenario).toBeNull();
    expect(data.re_exposure).toEqual({
      due: true,
      scenario_id: "core_01_training_system",
      pending_outcome_id: "pending-out-1",
    });
  });

  it("returns catalog scenario when router reports delayed pending but no no_change_reexposure row", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: true,
    });
    mockFetchFirstDueNoChangeReexposureMeta.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runtime_state).toBe("ARENA_SCENARIO_READY");
    expect(data.delayedOutcomePending).toBe(false);
    expect(data.scenario?.scenarioId).toBe("s1");
  });

  it("returns FORCED_RESET_PENDING when LE stage 4 with forced_reset_triggered_at", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 4,
      stageName: "Integrity Reset",
      forcedResetTriggeredAt: "2026-01-01T00:00:00.000Z",
      resetDueAt: "2026-01-03T00:00:00.000Z",
    });
    const req = new NextRequest("http://localhost/api/arena/n/session?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runtime_state).toBe("FORCED_RESET_PENDING");
    expect(data.scenario).toBeNull();
    expect(mockGetNextScenarioForSession).not.toHaveBeenCalled();
  });
});
