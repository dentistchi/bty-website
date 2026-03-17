/**
 * GET/PATCH /api/arena/profile — 401·200·400·500 (Arena profile).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/profile");
}

function makePatchRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/arena/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/arena/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 401 with error as string (GET)", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 500 with error as string when single returns error", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "profile_fetch_failed" },
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
    expect(data.error).toBe("profile_fetch_failed");
  });

  it("returns 200 with profile user_id present", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "Alice", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile).toBeDefined();
    expect(data.profile).toHaveProperty("user_id");
  });

  it("returns 200 with content-type application/json (GET)", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "U", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with profile when authenticated and profile exists", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ error: null });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "Test", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: mockRpc,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile).toBeDefined();
    expect(data.avatarCharacterId).toBeNull();
  });

  it("returns 200 with profile as object", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "Test", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.profile).toBe("object");
    expect(data.profile).not.toBeNull();
  });

  it("returns 200 with avatarCharacterId key present", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "Test", avatar_character_id: "char-1" },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("avatarCharacterId");
  });

  it("returns 200 with avatarCharacterId null or string", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "U", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.avatarCharacterId === null || typeof data.avatarCharacterId === "string").toBe(true);
  });

  it("returns 200 with profile display_name string or null", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: null, avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.display_name === null || typeof data.profile.display_name === "string").toBe(true);
  });

  it("returns 200 with exactly profile and avatarCharacterId keys", async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: "u1", display_name: "Test", avatar_character_id: null },
      error: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(["avatarCharacterId", "profile"].sort());
  });
});

describe("PATCH /api/arena/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await PATCH(makePatchRequest({ avatarUrl: "https://example.com/a.png" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key (PATCH)", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await PATCH(makePatchRequest({ avatarUrl: "https://x.com/a.png" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const req = new NextRequest("http://localhost/api/arena/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_JSON");
  });

  it("returns 400 with error as string when body not valid JSON (PATCH)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const req = new NextRequest("http://localhost/api/arena/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  it("returns 400 with JSON body containing only error key when body not valid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {},
      base: {},
    });
    const req = new NextRequest("http://localhost/api/arena/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });
});
