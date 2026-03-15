/**
 * GET /api/arena/leadership-engine/stage-summary — 401·200 (LE Stage + Arena·행동 패턴 요약).
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
  return new NextRequest("http://localhost/api/arena/leadership-engine/stage-summary");
}

describe("GET /api/arena/leadership-engine/stage-summary", () => {
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

  it("returns 200 with currentStage, stageName, progressPercent, arenaSummary, behaviorPattern", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 2,
      stageName: "Expectation Collapse (Cynicism Drift)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.currentStage).toBe(2);
    expect(data.stageName).toBe("Expectation Collapse (Cynicism Drift)");
    expect(data.progressPercent).toBe(50);
    expect(data.arenaSummary).toBeNull();
    expect(data.behaviorPattern).toBeNull();
    expect(mockEnsureLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
    expect(mockGetLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
  });
});
