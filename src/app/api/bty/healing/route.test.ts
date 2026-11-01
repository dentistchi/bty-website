/**
 * GET /api/bty/healing — 401·200 (Q4 Healing API 골격).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { healingReadClient } from "@/lib/bty/healing/__fixtures__/readClient";

const mockRequireUser = vi.fn();
const mockCopyCookiesAndDebug = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  requireConsentedUser: async (...args: unknown[]) => ({ consentDenied: null, ...(await mockRequireUser(...args)) }),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: (...args: unknown[]) => mockCopyCookiesAndDebug(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/bty/healing");
}

function supabaseActs(rows: { act_id: number }[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { second_awakening_completed_at: "2026-01-01T00:00:00Z" },
      error: null,
    }),
  };
  return { from: vi.fn(() => chain) };
}

describe("GET /api/bty/healing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyCookiesAndDebug.mockReset();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with ok, phase, content, awakeningProgress when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseActs([{ act_id: 1 }]),
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.phase).toBe("Phase II");
    expect(data.content).toEqual({ ringType: "phase_ring" });
    expect(data.awakeningProgress.progressPercent).toBe(33);
    expect(data.awakeningProgress.nextActId).toBe(2);
    expect(data.awakeningProgress.nextActName).toBe("Transition");
    expect(data.awakeningProgress.completedActIds).toEqual([1]);
    expect(data.awakeningProgress.allActsComplete).toBe(false);
  });

  it("returns 200 with content-type application/json and body shape (ok, phase, content)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: supabaseActs([]),
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(typeof data.ok).toBe("boolean");
    expect(typeof data.phase).toBe("string");
    expect(data.content).toBeDefined();
    expect(typeof data.content).toBe("object");
  });

  it("returns 200 with ok, phase, content, awakeningProgress", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseActs([]),
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(
      ["awakeningProgress", "content", "ok", "phase"].sort()
    );
    expect(data.awakeningProgress.nextActId).toBe(1);
  });

  it("returns 500 when copyCookiesAndDebug throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseActs([]),
      base: {},
    });
    mockCopyCookiesAndDebug.mockImplementation(() => {
      throw new Error("cookie copy failed");
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("INTERNAL_ERROR");
    expect(data.detail).toBe("cookie copy failed");
  });
});


describe("Healing unavailable progress is retryable", () => {
  beforeEach(() => { vi.clearAllMocks(); mockCopyCookiesAndDebug.mockReset(); });
  it("does not silently downgrade an unavailable milestone to Phase I", async () => {
    const { client } = healingReadClient({ milestoneError: { message: "private database details" } });
    mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
    const res = await GET(makeRequest()); expect(res.status).toBe(500);
    const body = await res.json(); expect(body).not.toHaveProperty("phase");
    expect(JSON.stringify(body)).not.toContain("private database details");
  });
  it("refuses consent before reading the user's phase", async () => {
    const { client, reads } = healingReadClient();
    mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {},
      consentDenied: new Response(JSON.stringify({ error: "consent_required" }), { status: 403 }) });
    expect((await GET(makeRequest())).status).toBe(403); expect(reads).toEqual([]);
  });
});


it("does not publish Phase I plus allActsComplete for three acts without their milestone", async () => {
  mockCopyCookiesAndDebug.mockReset();
  const { client } = healingReadClient({ acts: [1, 2, 3].map(act_id => ({ act_id })) });
  mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
  const res = await GET(makeRequest()); expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
});


it("returns review-required for a claimed starter that has no durable unlock", async () => {
  mockCopyCookiesAndDebug.mockReset();
  const { client } = healingReadClient({ milestone: { second_awakening_completed_at: "2026-07-01T12:00:00Z", starter_unlock_granted: "PRM" } });
  mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
  const res = await GET(makeRequest()); expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
});


it("does not publish a normal progress DTO for a non-prefix act history", async () => {
  mockCopyCookiesAndDebug.mockReset();
  const { client } = healingReadClient({ acts: [{ act_id: 2 }], trainDays: Array.from({ length: 28 }, (_, i) => i + 1) });
  mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
  const res = await GET(makeRequest()); expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "HEALING_COMPLETION_REVIEW_REQUIRED" });
});
