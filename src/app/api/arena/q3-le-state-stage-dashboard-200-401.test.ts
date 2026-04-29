/**
 * Q3: leadership-engine/state, stage-summary, dashboard/summary — 200·401 batch.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockGetLeadershipEngineState = vi.fn();
const mockEnsureLeadershipEngineState = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  ),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  getLeadershipEngineState: (...args: unknown[]) =>
    mockGetLeadershipEngineState(...args),
  ensureLeadershipEngineState: (...args: unknown[]) =>
    mockEnsureLeadershipEngineState(...args),
}));

const { GET: getState } = await import("./leadership-engine/state/route");
const { GET: getStageSummary } = await import(
  "./leadership-engine/stage-summary/route"
);
const { GET: getDashboardSummary } = await import(
  "./dashboard/summary/route"
);

describe("Q3 LE state · stage-summary · dashboard/summary — 200·401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: {},
      base: {},
    });
    mockEnsureLeadershipEngineState.mockResolvedValue(undefined);
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "S1",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });
  });

  it("401: unauthenticated GET state, stage-summary, dashboard/summary", async () => {
    const urls = [
      "http://localhost/api/arena/leadership-engine/state",
      "http://localhost/api/arena/leadership-engine/stage-summary",
      "http://localhost/api/arena/dashboard/summary",
    ];
    const handlers = [getState, getStageSummary, getDashboardSummary];

    for (let i = 0; i < handlers.length; i++) {
      const res = await handlers[i](new NextRequest(urls[i]));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("UNAUTHENTICATED");
      expect(Object.keys(data)).toEqual(["error"]);
    }
    expect(mockGetLeadershipEngineState).not.toHaveBeenCalled();
  });

  it("200: authenticated GET state, stage-summary, dashboard/summary", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({ gte: () => Promise.resolve({ data: [] }) }),
          }),
        }),
      },
      base: {},
    });

    const s1 = await getState(
      new NextRequest("http://localhost/api/arena/leadership-engine/state"),
    );
    expect(s1.status).toBe(200);
    const j1 = await s1.json();
    expect(j1.error).toBeUndefined();
    expect(j1.currentStage).toBe(1);

    const s2 = await getStageSummary(
      new NextRequest(
        "http://localhost/api/arena/leadership-engine/stage-summary",
      ),
    );
    expect(s2.status).toBe(200);
    const j2 = await s2.json();
    expect(j2.error).toBeUndefined();
    expect(j2.currentStage).toBe(1);
    expect(typeof j2.progressPercent).toBe("number");

    const s3 = await getDashboardSummary(
      new NextRequest("http://localhost/api/arena/dashboard/summary"),
    );
    expect(s3.status).toBe(200);
    const j3 = await s3.json();
    expect(j3.error).toBeUndefined();
    expect(j3.progress).toBeDefined();
    expect(j3.recommendation).toBeDefined();
    expect(j3.todayGrowth).toBeDefined();
  });
});
