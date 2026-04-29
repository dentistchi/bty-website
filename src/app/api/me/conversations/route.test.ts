/**
 * GET /api/me/conversations — 401·400·200 (Foundry mentor 이력).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();
vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
}));

function makeRequest(params?: { channel?: string; list?: string }): NextRequest {
  const search = new URLSearchParams();
  if (params?.channel) search.set("channel", params.channel);
  if (params?.list) search.set("list", params.list);
  const q = search.toString();
  return new NextRequest(`http://localhost/api/me/conversations${q ? `?${q}` : ""}`);
}

describe("GET /api/me/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });

    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    });
    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when channel is invalid", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });

    const res = await GET(makeRequest({ channel: "invalid" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("channel");
  });

  it("returns 400 with JSON body containing only error key when channel invalid", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    });
    const res = await GET(makeRequest({ channel: "invalid" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 500 when sessions list query fails", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "list_query_error" },
      }),
    });

    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("list_query_error");
  });

  it("returns 500 with JSON body containing only error key when list query fails", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "list_query_error" },
      }),
    });
    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with exactly sessions key", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["sessions"]);
  });

  it("returns 200 with sessions when list=sessions and channel=mentor", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: "s1", topic: "주제", created_at: "2026-03-10T00:00:00Z" }],
        error: null,
      }),
    });

    const res = await GET(makeRequest({ channel: "mentor", list: "sessions" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe("s1");
    expect(data.sessions[0].topic).toBe("주제");
  });

  it("returns 200 with content-type application/json on success", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const res = await GET(makeRequest({ channel: "chat", list: "sessions" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("sessions");
    expect(Array.isArray(data.sessions)).toBe(true);
  });
});
