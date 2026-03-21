/**
 * POST /api/arena/sub-name — 401·400·404 (서브네임 변경; S93 TASK9 INVALID_JSON·도메인 경계).
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

  /** S86 C3 TASK9: disallowed characters → INVALID_CHARS. */
  it("returns 400 INVALID_SUB_NAME when subName has invalid characters", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(makePostRequest({ subName: "a@b" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_SUB_NAME");
    expect(data.reason).toBe("INVALID_CHARS");
  });

  /** S93 TASK9: `arenaSubNameFromUnknown` — INVALID_JSON; omitted/null → EMPTY; MAX_7 vs INVALID at length 7/8. */
  it("returns 400 INVALID_JSON when body is not valid JSON", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res = await POST(
      new NextRequest("http://localhost/api/arena/sub-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_JSON");
  });

  it("returns 400 EMPTY when subName is omitted or JSON null", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const resOmit = await POST(makePostRequest({}));
    expect(resOmit.status).toBe(400);
    expect(await resOmit.json()).toEqual({
      error: "INVALID_SUB_NAME",
      reason: "EMPTY",
    });
    const resNull = await POST(makePostRequest({ subName: null as unknown as string }));
    expect(resNull.status).toBe(400);
    expect(await resNull.json()).toEqual({
      error: "INVALID_SUB_NAME",
      reason: "EMPTY",
    });
  });

  it("returns 400 INVALID_CHARS at 7 chars and MAX_7_CHARS at 8 when trailing @", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: { from: vi.fn() },
      base: {},
    });
    const res7 = await POST(makePostRequest({ subName: "xxxxxx@" }));
    expect(res7.status).toBe(400);
    expect((await res7.json()).reason).toBe("INVALID_CHARS");
    const res8 = await POST(makePostRequest({ subName: "xxxxxxx@" }));
    expect(res8.status).toBe(400);
    expect((await res8.json()).reason).toBe("MAX_7_CHARS");
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
