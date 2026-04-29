/**
 * POST /api/journey/bounce-back — 401·503·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetAuthUserFromRequest = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromRequest: (...args: unknown[]) => mockGetAuthUserFromRequest(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => mockGetSupabaseAdmin(...args),
}));

function makeRequest(): Request {
  return new Request("http://localhost/api/journey/bounce-back", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("POST /api/journey/bounce-back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Database not configured");
  });

  it("returns 500 when upsert fails", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 0, current_day: 1, season: 1 },
          }),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "db_error" },
          }),
        }),
      }),
    }));
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db_error");
  });

  it("returns 200 with bounce_back_count on success", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 0, current_day: 1, season: 1 },
          }),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 1 },
            error: null,
          }),
        }),
      }),
    }));
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bounce_back_count).toBe(1);
  });

  it("returns 200 with incremented bounce_back_count when profile exists", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 2, current_day: 3, season: 1 },
          }),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 3 },
            error: null,
          }),
        }),
      }),
    }));
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bounce_back_count).toBe(3);
  });

  it("returns 200 with exactly bounce_back_count key", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 0, current_day: 1, season: 1 },
          }),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 1 },
            error: null,
          }),
        }),
      }),
    }));
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["bounce_back_count"]);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockFrom = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 0, current_day: 1, season: 1 },
          }),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { bounce_back_count: 1 },
            error: null,
          }),
        }),
      }),
    }));
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("bounce_back_count");
  });
});
