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
    mockGetNextScenarioForSession.mockResolvedValue({
      scenario: { scenarioId: "s1", title: "T", context: "C", choices: [] },
      route: "catalog",
      delayedOutcomePending: false,
    });
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
  });
});
