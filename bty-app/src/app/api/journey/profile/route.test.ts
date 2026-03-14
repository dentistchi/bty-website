/**
 * GET/POST /api/journey/profile — 401·503·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

function makeGetRequest(): Request {
  return new Request("http://localhost/api/journey/profile", { method: "GET" });
}

describe("GET /api/journey/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Database not configured");
  });

  it("returns 200 with default profile when no row", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        }),
      }),
    });
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.current_day).toBe(1);
    expect(data.is_new).toBe(true);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        }),
      }),
    });
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("current_day");
    expect(data).toHaveProperty("is_new");
  });
});

describe("POST /api/journey/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const req = new Request("http://localhost/api/journey/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_day: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 500 when upsert fails", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "upsert_failed" },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    });

    const req = new Request("http://localhost/api/journey/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_day: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("upsert_failed");
  });
});
