/**
 * GET /api/bty/awakening — 401·200 (Q4 Awakening API).
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
  return new NextRequest("http://localhost/api/bty/awakening");
}

function supabaseWithActs(rows: { act_id: number }[]) {
  return healingReadClient({ acts: rows }).client;
}

describe("GET /api/bty/awakening", () => {
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

  it("returns 200 with acts and trigger when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseWithActs([{ act_id: 1 }]),
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.acts).toEqual({
      1: "Reflection Chamber",
      2: "Transition",
      3: "Awakening",
    });
    expect(data.trigger).toEqual({
      type: "day_based",
      day: 30,
      requires_min_sessions: 10,
    });
    expect(data.completedActs).toEqual([1]);
    expect(data.eligible).toBe(false);
  });

  it("returns 200 with content-type application/json and body shape (ok, acts, trigger)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: supabaseWithActs([]),
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(typeof data.ok).toBe("boolean");
    expect(data.acts).toBeDefined();
    expect(typeof data.acts).toBe("object");
    expect(data.trigger?.type).toBe("day_based");
    expect(typeof data.trigger?.day).toBe("number");
    expect(typeof data.trigger?.requires_min_sessions).toBe("number");
  });

  it("returns 200 with ok, acts, trigger, completedActs", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseWithActs([]),
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(
      ["acts", "completedActs", "eligible", "ok", "trigger"].sort()
    );
    expect(Array.isArray(data.completedActs)).toBe(true);
  });

  it("returns 500 with INTERNAL_ERROR and optional detail when handler throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: supabaseWithActs([]),
      base: {},
    });
    mockCopyCookiesAndDebug.mockImplementation(() => {
      throw new Error("internal failure");
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("INTERNAL_ERROR");
    expect(data.detail).toBe("internal failure");
  });
});


describe("Awakening current read contract", () => {
  beforeEach(() => { vi.clearAllMocks(); mockCopyCookiesAndDebug.mockReset(); });
  it("refuses consent before any progress or eligibility read", async () => {
    const { client, reads } = healingReadClient();
    mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {},
      consentDenied: new Response(JSON.stringify({ error: "consent_required" }), { status: 403 }) });
    expect((await GET(makeRequest())).status).toBe(403); expect(reads).toEqual([]);
  });
  it("uses real 28 distinct-day eligibility and scopes every query to the authenticated user", async () => {
    const { client, reads } = healingReadClient({ trainDays: Array.from({ length: 28 }, (_, i) => i + 1) });
    mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
    const res = await GET(makeRequest()); expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ eligible: true, completedActs: [] });
    expect(reads.length).toBeGreaterThan(4); expect(reads.every(read => read.userId === "owned-user")).toBe(true);
  });
  it.each(["actsError", "milestoneError", "trainError", "statsError", "eventsError"] as const)("does not treat unavailable %s as fresh eligible data", async source => {
    const { client } = healingReadClient({ trainDays: Array.from({ length: 28 }, (_, i) => i + 1),
      [source]: { message: "private database details" } });
    mockRequireUser.mockResolvedValue({ user: { id: "owned-user" }, supabase: client, base: {} });
    const res = await GET(makeRequest()); expect(res.status).toBe(500);
    const body = await res.json(); expect(body).not.toHaveProperty("eligible", true);
    expect(JSON.stringify(body)).not.toContain("private database details");
  });
});


it("returns review-required rather than all-acts-complete for a historical partial marker", async () => {
  mockCopyCookiesAndDebug.mockReset();
  const { client } = healingReadClient({ acts: [1, 2, 3].map(act_id => ({ act_id })), trainDays: Array.from({ length: 28 }, (_, i) => i + 1) });
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
