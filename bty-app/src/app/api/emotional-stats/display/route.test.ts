/**
 * GET /api/emotional-stats/display — 401·200.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mockRequireUser = vi.fn();
const thenableWithEmpty = {
  maybeSingle: () => Promise.resolve({ data: null }),
  then(resolve: (v: { data: unknown[] }) => void) {
    return Promise.resolve({ data: [] }).then(resolve);
  },
  catch(fn: (e: unknown) => void) {
    return Promise.resolve({ data: [] }).catch(fn);
  },
};
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: NextRequest, _base: Response) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/emotional-stats/display");
}

describe("GET /api/emotional-stats/display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: new Response() });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 401 with JSON body containing only error key", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: new Response() });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns 200 with phrases and phase when authenticated", async () => {
    const base = new Response();
    const supabase = {
      from: () => ({ select: () => ({ eq: () => thenableWithEmpty }) }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.phrases)).toBe(true);
    expect(data.phase).toBe(null);
  });

  it("returns 200 with content-type application/json on success", async () => {
    const base = new Response();
    const supabase = {
      from: () => ({ select: () => ({ eq: () => thenableWithEmpty }) }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const data = await res.json();
    expect(data).toHaveProperty("phrases");
    expect(data).toHaveProperty("phase");
  });
});
