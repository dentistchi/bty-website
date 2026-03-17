/**
 * GET /api/arena/leadership-engine/state — 401·200 (Foundry Leader Stage).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetLeadershipEngineState = vi.fn();
const mockEnsureLeadershipEngineState = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  getLeadershipEngineState: (...args: unknown[]) => mockGetLeadershipEngineState(...args),
  ensureLeadershipEngineState: (...args: unknown[]) => mockEnsureLeadershipEngineState(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/leadership-engine/state");
}

describe("GET /api/arena/leadership-engine/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockEnsureLeadershipEngineState.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetLeadershipEngineState).not.toHaveBeenCalled();
  });

  it("returns 401 with error as string", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 200 with currentStage and stageName when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 2,
      stageName: "Stage 2",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.currentStage).toBe(2);
    expect(data.stageName).toBe("Stage 2");
    expect(data.forcedResetTriggeredAt).toBeNull();
    expect(data.resetDueAt).toBeNull();
    expect(mockEnsureLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
    expect(mockGetLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
  });

  it("returns 200 with resetDueAt null or string", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Stage 1",
      forcedResetTriggeredAt: null,
      resetDueAt: "2026-04-01T00:00:00Z",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resetDueAt === null || typeof data.resetDueAt === "string").toBe(true);
  });
});
