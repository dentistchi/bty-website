/**
 * GET /api/me/region — 400·401·500·200·403 (Foundry org/region 멤버십).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServer = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: (...args: unknown[]) => mockGetSupabaseServer(...args),
}));

function makeRequest(params?: { orgId?: string; regionId?: string }): NextRequest {
  const search = new URLSearchParams();
  if (params?.orgId) search.set("orgId", params.orgId);
  if (params?.regionId) search.set("regionId", params.regionId);
  const q = search.toString();
  return new NextRequest(`http://localhost/api/me/region${q ? `?${q}` : ""}`);
}

describe("GET /api/me/region", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    });
  });

  it("returns 400 when orgId or regionId is missing", async () => {
    const res1 = await GET(makeRequest({ regionId: "r1" }));
    expect(res1.status).toBe(400);
    const d1 = await res1.json();
    expect(d1.error).toContain("orgId");

    const res2 = await GET(makeRequest({ orgId: "o1" }));
    expect(res2.status).toBe(400);
    const d2 = await res2.json();
    expect(d2.error).toContain("regionId");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 401 with hasSession false when no user", async () => {
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.hasSession).toBe(false);
    expect(data.error).toBe("no session");
  });

  it("returns 200 with allowed true when membership exists", async () => {
    const membership = { id: "m1", user_id: "u1", org_id: "o1", region_id: "r1", status: "active" };
    const result = { maybeSingle: vi.fn().mockResolvedValue({ data: membership, error: null }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(result) }),
        }),
      }),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
      ...chain,
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.allowed).toBe(true);
    expect(data.membership).toEqual(membership);
  });

  it("returns 500 when membership lookup fails", async () => {
    const result = { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "db_error" } }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(result) }),
        }),
      }),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
      ...chain,
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("membership lookup failed");
    expect(data.detail).toBe("db_error");
  });

  it("returns 403 with allowed false when no membership", async () => {
    const result = { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(result) }),
        }),
      }),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
      ...chain,
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.allowed).toBe(false);
    expect(data.membership).toBeNull();
  });

  it("returns 200 with content-type application/json when allowed", async () => {
    const membership = { id: "m1", user_id: "u1", org_id: "o1", region_id: "r1", status: "active" };
    const result = { maybeSingle: vi.fn().mockResolvedValue({ data: membership, error: null }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(result) }),
        }),
      }),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
      ...chain,
    });

    const res = await GET(makeRequest({ orgId: "o1", regionId: "r1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.allowed).toBe(true);
    expect(data).toHaveProperty("membership");
  });
});
