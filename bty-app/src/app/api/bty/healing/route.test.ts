/**
 * GET /api/bty/healing — 401·200 (Q4 Healing API 골격).
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
  return new NextRequest("http://localhost/api/bty/healing");
}

describe("GET /api/bty/healing", () => {
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

  it("returns 200 with ok, phase and content when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.phase).toBe("Phase II");
    expect(data.content).toEqual({ ringType: "phase_ring" });
  });

  it("returns 200 with content-type application/json and body shape (ok, phase, content)", async () => {
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
    expect(typeof data.phase).toBe("string");
    expect(data.content).toBeDefined();
    expect(typeof data.content).toBe("object");
  });

  it("returns 200 with exactly ok, phase, content keys (no extra fields)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["content", "ok", "phase"].sort());
  });

  it("returns 500 when copyCookiesAndDebug throws", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
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
