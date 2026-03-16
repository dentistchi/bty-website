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

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
    expect(data.error).toBe("UNAUTHENTICATED");
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
    expect(data.forcedResetTriggeredAt).toBeNull();
    expect(data.resetDueAt).toBeNull();
    expect(data.arenaSummary).toBeNull();
    expect(data.behaviorPattern).toBeNull();
    expect(mockEnsureLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
    expect(mockGetLeadershipEngineState).toHaveBeenCalledWith({}, "u1");
  });

  it("returns 200 with response shape matching LEStageSummary (currentStage, stageName, progressPercent, resetDueAt, forcedResetTriggeredAt, arenaSummary, behaviorPattern)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: {},
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: "2026-03-01T00:00:00Z",
      resetDueAt: "2026-03-15T00:00:00Z",
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();

    expect(data).toHaveProperty("currentStage");
    expect(data).toHaveProperty("stageName");
    expect(data).toHaveProperty("progressPercent");
    expect(data).toHaveProperty("forcedResetTriggeredAt");
    expect(data).toHaveProperty("resetDueAt");
    expect(data).toHaveProperty("arenaSummary");
    expect(data).toHaveProperty("behaviorPattern");

    expect(typeof data.currentStage).toBe("number");
    expect(typeof data.stageName).toBe("string");
    expect(typeof data.progressPercent).toBe("number");
    expect(data.currentStage).toBeGreaterThanOrEqual(1);
    expect(data.currentStage).toBeLessThanOrEqual(4);
    expect(data.progressPercent).toBeGreaterThanOrEqual(0);
    expect(data.progressPercent).toBeLessThanOrEqual(100);
    expect(data.forcedResetTriggeredAt === null || typeof data.forcedResetTriggeredAt === "string").toBe(true);
    expect(data.resetDueAt === null || typeof data.resetDueAt === "string").toBe(true);
    expect(data.arenaSummary === null || typeof data.arenaSummary === "object").toBe(true);
    expect(data.behaviorPattern === null || typeof data.behaviorPattern === "object").toBe(true);

    const expectedKeys = [
      "currentStage",
      "stageName",
      "progressPercent",
      "forcedResetTriggeredAt",
      "resetDueAt",
      "arenaSummary",
      "behaviorPattern",
    ];
    expect(Object.keys(data).sort()).toEqual(expectedKeys.sort());
  });

  const STAGE_PROGRESS: Array<{ stage: 1 | 2 | 3 | 4; percent: number }> = [
    { stage: 1, percent: 25 },
    { stage: 2, percent: 50 },
    { stage: 3, percent: 75 },
    { stage: 4, percent: 100 },
  ];

  it.each(STAGE_PROGRESS)(
    "returns 200 with progressPercent $percent for stage $stage",
    async ({ stage, percent }) => {
      mockRequireUser.mockResolvedValue({
        user: { id: "u1" },
        supabase: {},
        base: {},
      });
      mockGetLeadershipEngineState.mockResolvedValue({
        currentStage: stage,
        stageName: `Stage ${stage}`,
        forcedResetTriggeredAt: null,
        resetDueAt: null,
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.currentStage).toBe(stage);
      expect(data.progressPercent).toBe(percent);
    }
  );

  it("returns 200 with exactly StageSummaryResponse keys (no extra fields)", async () => {
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
    const expectedKeys = [
      "currentStage",
      "stageName",
      "progressPercent",
      "forcedResetTriggeredAt",
      "resetDueAt",
      "arenaSummary",
      "behaviorPattern",
    ].sort();
    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });
});
