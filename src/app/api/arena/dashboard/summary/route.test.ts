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

function makeRequest(url = "http://localhost/api/arena/dashboard/summary"): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/arena/dashboard/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    mockEnsureLeadershipEngineState.mockResolvedValue(undefined);
  });

  it("returns 200 with recommendation when source param is invalid (filter not applied)", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: "awareness",
      stageName: "Awareness",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });
    mockEnsureLeadershipEngineState.mockResolvedValue(undefined);

    const res = await GET(makeRequest("http://localhost/api/arena/dashboard/summary?source=invalid"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendation).not.toBeNull();
    expect(data.recommendation?.source).toBe("arena");
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

  /** C6 248: 401 비인증 짝 + LE ensure 실패 시 503. */
  it("248: returns 401 unauthenticated then 503 when ensureLeadershipEngineState throws", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    const r401 = await GET(makeRequest());
    expect(r401.status).toBe(401);

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
    mockEnsureLeadershipEngineState.mockRejectedValueOnce(new Error("db down"));
    const r503 = await GET(makeRequest());
    expect(r503.status).toBe(503);
    const body = await r503.json();
    expect(body.error).toBe("SERVICE_UNAVAILABLE");
    expect(body.message).toBe("LE_STATE_UNAVAILABLE");
    expect(r503.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  /** C6 239: 대시보드 요약 API 401→200 스모크 한 건. */
  it("239 smoke: unauthenticated 401 then authenticated 200 with progress", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    const r401 = await GET(makeRequest());
    expect(r401.status).toBe(401);

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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 2,
      stageName: "Test Stage",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });
    const r200 = await GET(makeRequest());
    expect(r200.status).toBe(200);
    expect(r200.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const body = await r200.json();
    expect(body.progress?.currentStage).toBe(2);
    expect(body.recommendation !== undefined).toBe(true);
  });

  /** C6 240: LE progress + todayGrowth + recommendation; 연장 필드 recommendedTrack 선택. */
  it("240 smoke: 401 then 200 with progress shape and optional recommendedTrack on recommendation", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: null, supabase: {}, base: {} });
    expect((await GET(makeRequest())).status).toBe(401);

    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({ gte: () => Promise.resolve({ data: [{ xp: 5 }] }) }),
          }),
        }),
      },
      base: {},
    });
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 3,
      stageName: "Stage Three",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(
      new NextRequest("http://localhost/api/arena/dashboard/summary?source=arena")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toMatchObject({
      currentStage: 3,
      stageName: "Stage Three",
      progressPercent: expect.any(Number),
    });
    expect(body.todayGrowth).toEqual({ xpToday: 5 });
    expect(body.recommendation).toMatchObject({
      nextAction: expect.any(String),
      source: "arena",
    });
    expect(
      body.recommendation.recommendedTrack === undefined ||
        body.recommendation.recommendedTrack === null ||
        typeof body.recommendation.recommendedTrack === "string"
    ).toBe(true);
  });

  it("returns 200 with progress, recommendation, and todayGrowth", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["progress", "recommendation", "todayGrowth"].sort());
    expect(data.progress).toBeDefined();
    expect(data.progress.currentStage).toBe(1);
    expect(data.progress.stageName).toBe("Over-Intervention (Speed Bias)");
    expect(data.progress.progressPercent).toBe(25);
    expect(data.recommendation).toEqual({
      nextAction: "Continue Arena",
      source: "arena",
      priority: 30,
    });
    expect(data.todayGrowth).toEqual({ xpToday: 0 });
  });

  it("returns 200 with content-type application/json and recommendation shape", async () => {
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
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({ gte: () => Promise.resolve({ data: [] }) }),
          }),
        }),
      },
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

  it("returns 200 with recommendation source matching RECOMMENDATION_SOURCE_PRIORITY (arena 30, foundry 20, center 10)", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendation).not.toBeNull();
    expect(data.recommendation.source).toBe("arena");
    expect(data.recommendation.priority).toBe(30);
  });

  it("returns 200 with recommendation unchanged when query source is invalid (ignored)", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest("http://localhost/api/arena/dashboard/summary?source=invalid"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendation).not.toBeNull();
    expect(data.recommendation.source).toBe("arena");
  });

  it("returns 200 with recommendation null when query source does not match (source=foundry)", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest("http://localhost/api/arena/dashboard/summary?source=foundry"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendation).toBeNull();
    expect(data.progress).toBeDefined();
    expect(data.todayGrowth).toEqual({ xpToday: 0 });
  });

  it("returns 200 with recommendation object containing only nextAction, source, priority keys", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const rec = (await res.json()).recommendation;
    expect(rec).not.toBeNull();
    expect(Object.keys(rec).sort()).toEqual(["nextAction", "priority", "source"].sort());
  });

  it("returns 200 with recommendation when query source=arena", async () => {
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
    mockGetLeadershipEngineState.mockResolvedValue({
      currentStage: 1,
      stageName: "Over-Intervention (Speed Bias)",
      forcedResetTriggeredAt: null,
      resetDueAt: null,
    });

    const res = await GET(makeRequest("http://localhost/api/arena/dashboard/summary?source=arena"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recommendation).not.toBeNull();
    expect(data.recommendation.source).toBe("arena");
  });
});
