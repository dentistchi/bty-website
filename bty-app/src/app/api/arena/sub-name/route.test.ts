/**
 * POST /api/arena/sub-name — 401·400·403·200 (서브네임 변경).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  unauthenticated: vi.fn((_req: unknown, _base: unknown) =>
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 })
  ),
  copyCookiesAndDebug: vi.fn(),
}));

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/arena/sub-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/sub-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
    const res = await POST(makePostRequest({ subName: "Valid" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when subName is empty", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "   " }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("EMPTY");
  });

  it("returns 400 when subName exceeds 7 chars", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "EightChar" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("MAX_7_CHARS");
  });

  /** SPRINT 49 TASK 9 / 255: 프로필 없음 → 404. */
  it("returns 404 when arena_profiles row missing", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "Nick" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("NOT_FOUND");
  });
});
