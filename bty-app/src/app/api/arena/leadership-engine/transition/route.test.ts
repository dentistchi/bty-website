/**
 * POST /api/arena/leadership-engine/transition — 401·400·200 (Foundry Leader Stage 전환).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockApplyStageTransition = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/leadership-engine/state-service", () => ({
  applyStageTransition: (...args: unknown[]) => mockApplyStageTransition(...args),
}));

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/arena/leadership-engine/transition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/leadership-engine/transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await POST(makePostRequest({ context: "stage_4_completion" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockApplyStageTransition).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const req = new NextRequest("http://localhost/api/arena/leadership-engine/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_JSON");
  });

  it("returns 400 when context is invalid", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const res = await POST(makePostRequest({ context: "invalid_context" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_CONTEXT");
    expect(data.allowed).toBeDefined();
    expect(mockApplyStageTransition).not.toHaveBeenCalled();
  });

  it("returns 200 with applied and currentStage when context valid", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockApplyStageTransition.mockResolvedValue({
      applied: true,
      currentStage: 2,
      previousStage: 1,
      stageName: "Stage 2",
    });

    const res = await POST(makePostRequest({ context: "repeat_1_without_delegation" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applied).toBe(true);
    expect(data.currentStage).toBe(2);
    expect(data.previousStage).toBe(1);
    expect(data.stageName).toBe("Stage 2");
    expect(mockApplyStageTransition).toHaveBeenCalledWith({}, "u1", "repeat_1_without_delegation");
  });
});
