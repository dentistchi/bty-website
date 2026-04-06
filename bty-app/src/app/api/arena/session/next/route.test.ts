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
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
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
    expect(mockGetNextScenarioForSession).toHaveBeenCalledWith("u1", "en", {
      servedArenaScenarioIds: [],
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
