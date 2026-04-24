/**
 * GET /api/arena/session/next — pending action contract gate (409) + selection.
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

const mockGetArenaPipelineDefault = vi.fn((): "new" | "legacy" => "legacy");
vi.mock("@/lib/bty/arena/arenaPipelineConfig", () => ({
  getArenaPipelineDefault: () => mockGetArenaPipelineDefault(),
}));

vi.mock("@/lib/bty/arena/blockingArenaActionContract", () => ({
  fetchBlockingArenaContractForSession: (...args: unknown[]) => mockFetchBlocking(...args),
}));

const mockGetLeadershipEngineState = vi.fn();
const mockConsumeDueDelayedOutcomeTriggersForUser = vi.fn();
const mockFetchFirstDueReexposureMeta = vi.fn();
vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  getLeadershipEngineState: (...args: unknown[]) => mockGetLeadershipEngineState(...args),
}));

vi.mock("@/engine/memory/delayed-outcome-consumer.service", () => ({
  consumeDueDelayedOutcomeTriggersForUser: (...args: unknown[]) =>
    mockConsumeDueDelayedOutcomeTriggersForUser(...args),
}));

vi.mock("@/engine/scenario/delayed-outcome-trigger.service", () => ({
  fetchFirstDueReexposureMeta: (...args: unknown[]) => mockFetchFirstDueReexposureMeta(...args),
}));

function makeSupabaseForSessionRouter() {
  const lte = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    lte,
  };
  updateChain.eq.mockReturnValue(updateChain);
  const update = vi.fn().mockReturnValue(updateChain);

  const arenaRunsStatusEq = vi.fn().mockResolvedValue({ data: [], error: null });
  const arenaRunsUserIdEq = vi.fn().mockReturnValue({ eq: arenaRunsStatusEq });
  const arenaRunsSelect = vi.fn().mockReturnValue({ eq: arenaRunsUserIdEq });

  const from = vi.fn((table: string) => {
    if (table === "bty_action_contracts") {
      return { update };
    }
    if (table === "arena_runs") {
      return { select: arenaRunsSelect };
    }
    return { select: vi.fn() };
  });

  return { from, lte, arenaRunsUserIdEq, arenaRunsStatusEq };
}

describe("GET /api/arena/session/next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetArenaPipelineDefault.mockReturnValue("legacy");
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
    mockFetchFirstDueReexposureMeta.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 410 when ARENA_PIPELINE_DEFAULT=new (deprecated)", async () => {
    mockGetArenaPipelineDefault.mockReturnValue("new");
    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toBe("arena_session_next_deprecated");
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("returns 409 action_contract_pending when blocking contract exists", async () => {
    const pending = {
      id: "c1",
      contract_description: "Do the thing",
      deadline_at: new Date(Date.now() + 60_000).toISOString(),
      verification_mode: "hybrid",
      created_at: new Date().toISOString(),
      status: "pending",
    };
    mockFetchBlocking.mockResolvedValue(pending);
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("action_contract_pending");
    expect(data.contract).toEqual({
      id: pending.id,
      action_text: pending.contract_description,
      deadline_at: pending.deadline_at,
      verification_type: pending.verification_mode,
      created_at: pending.created_at,
    });
    expect(data.mode).toBe("arena");
    expect(data.runtime_state).toBe("ACTION_REQUIRED");
    expect(data.scenario).toBeNull();
    expect(data.gates?.next_allowed).toBe(false);
    expect(data.action_contract?.exists).toBe(true);
    expect(mockGetNextScenarioForSession).not.toHaveBeenCalled();
  });

  it("inline-expires overdue pending and proceeds to getNextScenarioForSession when no blocking contract", async () => {
    const { from, lte } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith("u1", "en", {
      servedArenaScenarioIds: [],
    });
    expect(lte).toHaveBeenCalled();
  });

  it("proceeds normally when no pending contract", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.delayedOutcomePending).toBe(false);
    expect(data.scenario?.scenarioId).toBe("s1");
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith("u1", "en", {
      servedArenaScenarioIds: [],
    });
  });

  it("returns delayedOutcomePending=true when delayed_outcome trigger is due", async () => {
    const { from } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
    mockConsumeDueDelayedOutcomeTriggersForUser.mockResolvedValue({
      consumedCount: 1,
      firstTriggerId: "dq1",
      triggers: [
        {
          triggerId: "dq1",
          dueAt: "2026-01-01T00:00:00.000Z",
          payload: { pending_outcome_id: "po1", source_choice_history_id: "h1" },
        },
      ],
    });
    mockFetchFirstDueReexposureMeta.mockResolvedValue({
      scenarioId: "SCN_PT_0001",
      pendingOutcomeId: "po1",
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.delayedOutcomePending).toBe(true);
    expect(data.runtime_state).toBe("REEXPOSURE_DUE");
    expect(data.re_exposure).toEqual(
      expect.objectContaining({
        due: true,
        scenario_id: "SCN_PT_0001",
        pending_outcome_id: "po1",
        trigger_id: "dq1",
        trigger_payload: { pending_outcome_id: "po1", source_choice_history_id: "h1" },
      }),
    );
    expect(data.scenario).toBeNull();
    expect(mockConsumeDueDelayedOutcomeTriggersForUser).toHaveBeenCalledWith({
      userId: "u1",
      supabase: { from },
    });
  });

  it("queries arena_runs with status DONE when building served scenario exclusion", async () => {
    const { from, arenaRunsUserIdEq, arenaRunsStatusEq } = makeSupabaseForSessionRouter();
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from },
      base: {},
    });

    const req = new NextRequest("http://localhost/api/arena/session/next?locale=en");
    await GET(req);

    expect(arenaRunsUserIdEq).toHaveBeenCalledWith("user_id", "u1");
    expect(arenaRunsStatusEq).toHaveBeenCalledWith("status", "DONE");
  });
});
