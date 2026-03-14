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
  });
});
