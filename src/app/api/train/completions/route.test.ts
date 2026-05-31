/**
 * POST /api/train/completions — 401·400·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/train/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/train/completions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ upsert: () => Promise.resolve() }),
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ day: 1 }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 400 when day is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: 0 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid day");
  });

  it("returns 400 when day is not a number", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: "abc" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid day");
  });

  it("returns 400 when day is out of range (29)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: 29 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("invalid day");
  });

  it("returns 503 when admin client not configured", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await POST(makeRequest({ day: 1 }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Server not configured");
  });

  it("returns 200 with exactly ok key", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["ok"]);
    expect(data.ok).toBe(true);
  });

  it("returns 200 with ok true when authenticated and day valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(makeRequest({ day: 3 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("rejects when upsert rejects", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        upsert: () => Promise.reject(new Error("db constraint")),
      }),
    });

    await expect(POST(makeRequest({ day: 1 }))).rejects.toThrow("db constraint");
  });
});
