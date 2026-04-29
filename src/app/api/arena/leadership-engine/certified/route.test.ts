/**
 * GET /api/arena/leadership-engine/certified — 401·200 (Foundry Leader Certified).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const mockGetCertifiedStatus = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));
vi.mock("@/lib/bty/leadership-engine/certified-lri-service", () => ({
  getCertifiedStatus: (...args: unknown[]) => mockGetCertifiedStatus(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/leadership-engine/certified");
}

describe("GET /api/arena/leadership-engine/certified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: {},
      base: {},
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(mockGetCertifiedStatus).not.toHaveBeenCalled();
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with current and reasons when authenticated", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: chain,
      base: {},
    });
    mockGetCertifiedStatus.mockResolvedValue({
      current: false,
      reasons_met: [],
      reasons_missing: ["air_14d_ge_80", "mwd_14d_ge_threshold"],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.current).toBe(false);
    expect(data.reasons_met).toEqual([]);
    expect(data.reasons_missing).toContain("air_14d_ge_80");
    expect(Object.keys(data).sort()).toEqual(["current", "reasons_met", "reasons_missing"].sort());
    expect(mockGetCertifiedStatus).toHaveBeenCalledWith("u1", expect.any(Function));
  });

  it("returns 200 with current true when certified", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u2" },
      supabase: chain,
      base: {},
    });
    mockGetCertifiedStatus.mockResolvedValue({
      current: true,
      reasons_met: ["air_14d_ge_80", "mwd_14d_ge_threshold", "reset_compliance_met", "no_integrity_slip_in_14d"],
      reasons_missing: [],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.current).toBe(true);
    expect(data.reasons_missing).toHaveLength(0);
    expect(Object.keys(data).sort()).toEqual(["current", "reasons_met", "reasons_missing"].sort());
  });

  it("returns 200 with exactly current, reasons_met, reasons_missing keys", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: chain,
      base: {},
    });
    mockGetCertifiedStatus.mockResolvedValue({
      current: false,
      reasons_met: [],
      reasons_missing: [],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["current", "reasons_met", "reasons_missing"].sort());
  });
});
