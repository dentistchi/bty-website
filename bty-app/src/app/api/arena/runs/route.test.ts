/**
 * GET /api/arena/runs — 401·500 (Arena §6·§7·§8).
 * Past scenarios: 인증 실패(401)·에러 응답(500) 테스트.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/arena/runs");
}

describe("GET /api/arena/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("returns 401 with message when unauthenticated", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("UNAUTHENTICATED");
    expect(data.message).toBe("Sign in to see past scenarios");
  });

  it("returns 500 when arena_runs query fails", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "DB_ERROR" },
                }),
            }),
          }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB_ERROR");
    expect(data.detail).toBeDefined();
  });
});
