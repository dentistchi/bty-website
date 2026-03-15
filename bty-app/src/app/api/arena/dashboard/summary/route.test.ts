/**
 * GET /api/arena/dashboard/summary — 401·200 (대시보드 진도·추천 요약).
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
  return new NextRequest("http://localhost/api/arena/dashboard/summary");
}

describe("GET /api/arena/dashboard/summary", () => {
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

  it("returns 200 with progress and recommendation", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress).toBeDefined();
    expect(data.progress.currentStage).toBe(1);
    expect(data.progress.stageName).toBe("Over-Intervention (Speed Bias)");
    expect(data.progress.progressPercent).toBe(25);
    expect(data.recommendation).toEqual({
      nextAction: "Continue Arena",
      source: "arena",
      priority: 1,
    });
  });

  it("returns 200 with content-type application/json and recommendation shape", async () => {
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
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.recommendation).toHaveProperty("nextAction");
    expect(data.recommendation).toHaveProperty("source");
    expect(data.recommendation).toHaveProperty("priority");
    expect(typeof data.recommendation.priority).toBe("number");
  });

  it("returns 200 with recommendation fields matching RecommendationSummary (nextAction string, source in arena|foundry|center|null, priority number)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 3,
      stageName: "Leadership Withdrawal (Responsibility Avoidance)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    const rec = data.recommendation;
    expect(rec).toBeDefined();
    expect(typeof rec.nextAction).toBe("string");
    expect(rec.nextAction).toBeTruthy();
    expect(["arena", "foundry", "center", null]).toContain(rec.source);
    expect(typeof rec.priority).toBe("number");
  });
});
