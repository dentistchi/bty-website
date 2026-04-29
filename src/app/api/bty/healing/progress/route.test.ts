/**
 * POST /api/bty/healing/progress — 401·400·409·200 (241 C4).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

const mockRequireUser = vi.fn();
const mockComplete = vi.fn();
const mockGetProgress = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })),
  copyCookiesAndDebug: vi.fn(),
}));

vi.mock("@/lib/bty/healing/completeAwakeningAct", () => ({
  completeHealingAwakeningAct: (...args: unknown[]) => mockComplete(...args),
  getHealingAwakeningProgress: (...args: unknown[]) => mockGetProgress(...args),
}));

function req(body?: object): NextRequest {
  return new NextRequest("http://localhost/api/bty/healing/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : "{}",
  });
}

describe("GET /api/bty/healing/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("401 unauthenticated", async () => {
    const res = await GET(new NextRequest("http://localhost/api/bty/healing/progress"));
    expect(res.status).toBe(401);
  });

  it("200 completedActs nextAct", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockGetProgress.mockResolvedValue({ ok: true, completedActs: [1], nextAct: 2 });
    const res = await GET(new NextRequest("http://localhost/api/bty/healing/progress"));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.completedActs).toEqual([1]);
    expect(d.nextAct).toBe(2);
  });

  /** C6 244: 빈 진행 → nextAct 1. */
  it("244 smoke: 200 empty completedActs and nextAct 1", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u244" },
      supabase: {},
      base: {},
    });
    mockGetProgress.mockResolvedValue({ ok: true, completedActs: [], nextAct: 1 });
    const res = await GET(new NextRequest("http://localhost/api/bty/healing/progress"));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.completedActs).toEqual([]);
    expect(d.nextAct).toBe(1);
  });
});

describe("POST /api/bty/healing/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("401 when unauthenticated", async () => {
    const res = await POST(req({ actId: 1 }));
    expect(res.status).toBe(401);
  });

  it("400 INVALID_JSON on bad body", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const r = new NextRequest("http://localhost/api/bty/healing/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(r);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it("409 ACT_ALREADY_COMPLETED from service", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockComplete.mockResolvedValue({ status: 409, error: "ACT_ALREADY_COMPLETED" });
    const res = await POST(req({ actId: 1 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("ACT_ALREADY_COMPLETED");
  });

  /** C6 242: 400 선행 액트·잘못된 actId. */
  it("400 ACT_PREREQUISITE when service returns prerequisite error", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockComplete.mockResolvedValue({ status: 400, error: "ACT_PREREQUISITE" });
    const res = await POST(req({ actId: 3 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ACT_PREREQUISITE");
  });

  it("400 INVALID_ACT_ID when service rejects actId", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockComplete.mockResolvedValue({ status: 400, error: "INVALID_ACT_ID" });
    const res = await POST(req({ actId: 99 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_ACT_ID");
  });

  it("200 with completedActs", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    mockComplete.mockResolvedValue({ ok: true, completedActs: [1] });
    const res = await POST(req({ actId: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.completedActs).toEqual([1]);
  });
});
