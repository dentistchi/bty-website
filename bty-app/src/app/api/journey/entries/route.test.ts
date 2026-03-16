/**
 * GET/POST /api/journey/entries — 401·503·400·200.
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

describe("GET /api/journey/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(new Request("http://localhost/api/journey/entries", { method: "GET" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await GET(new Request("http://localhost/api/journey/entries", { method: "GET" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Database not configured");
  });

  it("returns 503 with JSON body containing only error key", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);
    const res = await GET(new Request("http://localhost/api/journey/entries", { method: "GET" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with empty array when no rows", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

    const res = await GET(new Request("http://localhost/api/journey/entries", { method: "GET" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns 400 when day param invalid", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });

    const res = await GET(
      new Request("http://localhost/api/journey/entries?day=0", { method: "GET" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid day");
  });

  it("returns 200 with single entry when day param valid and row exists", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", day: 7, completed: true, updated_at: "2026-03-10T12:00:00Z" },
      error: null,
    });
    const mockEqDay = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqDay });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue({ select: mockSelect }) });

    const res = await GET(
      new Request("http://localhost/api/journey/entries?day=7", { method: "GET" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.day).toBe(7);
    expect(data.user_id).toBe("u1");
    expect(data.completed).toBe(true);
  });
});

describe("POST /api/journey/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserFromRequest.mockResolvedValue(null);
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = new Request("http://localhost/api/journey/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const req = new Request("http://localhost/api/journey/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Database not configured");
  });

  it("returns 500 when upsert fails", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "upsert_error" },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    });

    const req = new Request("http://localhost/api/journey/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("upsert_error");
  });

  it("returns 200 with upserted row on valid body", async () => {
    mockGetAuthUserFromRequest.mockResolvedValue({ id: "u1" });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", day: 1, completed: false, updated_at: "2026-03-11T00:00:00Z" },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    });

    const req = new Request("http://localhost/api/journey/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.day).toBe(1);
    expect(data.user_id).toBe("u1");
  });
});
