/**
 * GET /api/me/access — 401·503·200 (Foundry 사용자 멤버십).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServer = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServer: (...args: unknown[]) => mockGetSupabaseServer(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/me/access");
}

describe("GET /api/me/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when admin client is not configured", async () => {
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
    });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Server not configured");
  });

  it("returns 200 with empty memberships when user has none", async () => {
    const inner = {
      eq: vi.fn().mockResolvedValue({ data: [] }),
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue(inner),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
    });
    mockGetSupabaseAdmin.mockReturnValue(chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toEqual({ id: "u1", email: "u@x.com" });
    expect(data.memberships).toEqual([]);
  });

  it("returns 200 with user and memberships when authenticated", async () => {
    const inner = {
      eq: vi.fn().mockResolvedValue({
        data: [{ org_id: "o1", region_id: "r1", role: "member", status: "active" }],
      }),
    };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue(inner),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
    });
    mockGetSupabaseAdmin.mockReturnValue(chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toEqual({ id: "u1", email: "u@x.com" });
    expect(data.memberships).toHaveLength(1);
    expect(data.memberships[0].org_id).toBe("o1");
  });

  it("queries memberships with user_id and status active", async () => {
    const inner = { eq: vi.fn().mockResolvedValue({ data: [] }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue(inner),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u2", email: "u2@x.com" } }, error: null }) },
    });
    mockGetSupabaseAdmin.mockReturnValue(chain);

    await GET(makeRequest());

    expect(chain.from).toHaveBeenCalledWith("memberships");
    expect(chain.select).toHaveBeenCalledWith("org_id, region_id, role, job_function, status");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u2");
    expect(inner.eq).toHaveBeenCalledWith("status", "active");
  });

  it("returns 200 with content-type application/json on success", async () => {
    const inner = { eq: vi.fn().mockResolvedValue({ data: [] }) };
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue(inner),
    };
    mockGetSupabaseServer.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "u@x.com" } }, error: null }) },
    });
    mockGetSupabaseAdmin.mockReturnValue(chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("user");
    expect(data).toHaveProperty("memberships");
  });
});
