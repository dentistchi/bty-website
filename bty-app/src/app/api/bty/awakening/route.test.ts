/**
 * GET /api/bty/awakening — 401·200 (Q4 Awakening API).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockCopyCookiesAndDebug = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: (...args: unknown[]) => mockCopyCookiesAndDebug(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/bty/awakening");
}

describe("GET /api/bty/awakening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with acts and trigger when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
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
  });

  it("returns 200 with content-type application/json and body shape (ok, acts, trigger)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: {},
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

  it("returns 200 with exactly ok, acts, trigger keys (no extra fields)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["acts", "ok", "trigger"].sort());
  });

  it("returns 500 with INTERNAL_ERROR and optional detail when handler throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
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
