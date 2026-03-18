/**
 * GET /api/arena/core-xp — 401·200 (Core XP, tier, code/sub, avatar).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/core-xp");
}

describe("GET /api/arena/core-xp", () => {
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

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 401 with error as string", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(typeof data.error).toBe("string");
  });

  /** C6 251: 비세션 연속 GET 모두 401 (짝·안정). */
  it("251: returns 401 on consecutive unauthenticated GETs", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const r1 = await GET(makeRequest());
    const r2 = await GET(makeRequest());
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect((await r1.json()).error).toBe("UNAUTHENTICATED");
    expect((await r2.json()).error).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with content-type application/json", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns 200 with codeName as string", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.codeName).toBe("string");
    expect(data.codeName.length).toBeGreaterThan(0);
  });

  it("returns 200 with default payload when authenticated and no profile row", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };

    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.coreXpTotal).toBe(0);
    expect(data.tier).toBe(0);
    expect(data.requiresBeginnerPath).toBe(true);
    expect(data.codeName).toBe("FORGE");
    expect(data.subName).toBe("Spark");
    expect(String(res.headers.get("Cache-Control") ?? "")).toMatch(/no-store/);
    const expectedKeys = [
      "avatarCharacterId",
      "avatarCharacterImageUrl",
      "avatarCharacterLocked",
      "avatarOutfitImageUrl",
      "avatarOutfitTheme",
      "avatarSelectedOutfitId",
      "avatarUrl",
      "codeHidden",
      "codeName",
      "coreXpTotal",
      "currentOutfit",
      "requiresBeginnerPath",
      "seasonalXpTotal",
      "subName",
      "subNameRenameAvailable",
      "tier",
    ].sort();
    expect(Object.keys(data).sort()).toEqual(expectedKeys);
  });

  it("returns 200 with subName as string", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.subName).toBe("string");
  });

  it("returns 200 with coreXpTotal and tier as numbers", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.coreXpTotal).toBe("number");
    expect(typeof data.tier).toBe("number");
  });

  it("returns 200 with tier non-negative", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.tier).toBe("number");
    expect(data.tier).toBeGreaterThanOrEqual(0);
  });

  it("returns 200 with seasonalXpTotal as number", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.seasonalXpTotal).toBe("number");
  });

  it("returns 200 with codeHidden as boolean", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.codeHidden).toBe("boolean");
  });

  it("returns 200 with requiresBeginnerPath as boolean", async () => {
    const countResult = { count: 0, error: null };
    const countThenable = Object.assign(Promise.resolve(countResult), {
      gt: () => Promise.resolve(countResult),
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const select = vi.fn().mockImplementation((_sel: string | unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return { is: () => countThenable };
          }
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({ maybeSingle }),
              maybeSingle: table === "arena_profiles" ? maybeSingle : undefined,
            }),
          };
        });
        return { select };
      }),
    };
    mockRequireUser.mockResolvedValue({ user: { id: "u1" }, supabase, base: {} });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.requiresBeginnerPath).toBe("boolean");
  });
});
