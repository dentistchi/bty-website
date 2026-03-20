/**
 * GET /api/arena/runs — 무세션 200·500·cursor·400·nextCursor (247).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { encodeRunsCursor } from "@/lib/bty/arena/runsCursor";
import { ARENA_RUNS_CURSOR_MAX_LENGTH } from "@/domain/rules/arenaRunsCursorMaxLength";

const mockRequireUser = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  copyCookiesAndDebug: vi.fn(),
}));

/** 첫 페이지: eq → order×2 → limit(n). */
function firstPageSupabase(rows: unknown[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: rows, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("GET /api/arena/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });
  });

  it("clamps limit query to 1–50 (invalid uses default)", async () => {
    let seenLimit = 0;
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  limit: (n: number) => {
                    seenLimit = n;
                    return Promise.resolve({ data: [], error: null });
                  },
                }),
              }),
            }),
          }),
        }),
      },
      base: {},
    });
    await GET(new NextRequest("http://localhost/api/arena/runs?limit=0"));
    expect(seenLimit).toBe(11); // default 10 + 1
    seenLimit = 0;
    await GET(new NextRequest("http://localhost/api/arena/runs?limit=100"));
    expect(seenLimit).toBe(51); // max 50 + 1
  });

  it("returns 200 with empty runs when unauthenticated (no scary error in Arena UI)", async () => {
    mockRequireUser.mockResolvedValue({ user: null, supabase: {}, base: {} });

    const res = await GET(new NextRequest("http://localhost/api/arena/runs"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runs).toEqual([]);
    expect(data.nextCursor).toBeNull();
    expect(data.viewerAnonymous).toBe(true);
  });

  it("returns 500 when arena_runs query fails", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: firstPageSupabase([], { message: "DB_ERROR" }),
      base: {},
    });

    const res = await GET(new NextRequest("http://localhost/api/arena/runs"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB_ERROR");
    expect(data.detail).toBeDefined();
  });

  it("returns 200 with runs and nextCursor when authenticated", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: firstPageSupabase([], null),
      base: {},
    });

    const res = await GET(new NextRequest("http://localhost/api/arena/runs"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const data = await res.json();
    expect(data.runs).toEqual([]);
    expect(data.nextCursor).toBeNull();
  });

  /** C6 244 C4 짝: limit 쿼리·행 shape. */
  it("244: limit=2 passes fetchSize limit+1 and returns run rows", async () => {
    let seenLimit = 0;
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                limit: (n: number) => {
                  seenLimit = n;
                  return Promise.resolve({
                    data: [
                      {
                        run_id: "aaaaaaaa-bbbb-4ccc-8eee-eeeeeeeeeeee",
                        scenario_id: "sc-1",
                        locale: "en",
                        started_at: "2026-01-01T00:00:00.000Z",
                        status: "DONE",
                      },
                    ],
                    error: null,
                  });
                },
              }),
            }),
          }),
        }),
      }),
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u244" },
      supabase,
      base: {},
    });
    const res = await GET(new NextRequest("http://localhost/api/arena/runs?limit=2"));
    expect(res.status).toBe(200);
    expect(seenLimit).toBe(3);
    const data = await res.json();
    expect(data.runs).toHaveLength(1);
    expect(data.runs[0]).toMatchObject({
      run_id: "aaaaaaaa-bbbb-4ccc-8eee-eeeeeeeeeeee",
      scenario_id: "sc-1",
      status: "DONE",
    });
    expect(data.viewerAnonymous).toBeUndefined();
    expect(data.nextCursor).toBeNull();
  });

  it("247: returns 400 INVALID_CURSOR for malformed cursor", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: firstPageSupabase([], null),
      base: {},
    });
    const res = await GET(new NextRequest("http://localhost/api/arena/runs?cursor=not-valid-base64!!!"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_CURSOR");
  });

  it("returns 400 INVALID_CURSOR when cursor exceeds max length", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: firstPageSupabase([], null),
      base: {},
    });
    const longCursor = "a".repeat(ARENA_RUNS_CURSOR_MAX_LENGTH + 1);
    const res = await GET(
      new NextRequest(`http://localhost/api/arena/runs?cursor=${encodeURIComponent(longCursor)}`),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_CURSOR");
  });

  it("247: cursor resolves anchor then applies or filter", async () => {
    const anchorRid = "99999999-aaaa-4bbb-8ccc-dddddddddddd";
    let sawOr = "";
    let fromCall = 0;
    const supabase = {
      from: () => {
        fromCall += 1;
        if (fromCall === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { started_at: "2026-03-01T00:00:00.000Z", run_id: anchorRid },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              or: (s: string) => {
                sawOr = s;
                return {
                  order: () => ({
                    order: () => ({
                      limit: () =>
                        Promise.resolve({
                          data: [
                            {
                              run_id: "11111111-2222-4333-8444-555555555555",
                              scenario_id: "s",
                              locale: "en",
                              started_at: "2026-02-01T12:00:00.000Z",
                              status: "DONE",
                            },
                          ],
                          error: null,
                        }),
                    }),
                  }),
                };
              },
            }),
          }),
        };
      },
    };
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase,
      base: {},
    });
    const cur = encodeRunsCursor({ started_at: "2026-03-01T00:00:00.000Z", run_id: anchorRid });
    const res = await GET(new NextRequest(`http://localhost/api/arena/runs?limit=10&cursor=${encodeURIComponent(cur)}`));
    expect(res.status).toBe(200);
    expect(sawOr).toContain("started_at.lt.");
    expect((await res.json()).runs).toHaveLength(1);
  });

  it("247: nextCursor set when more than limit rows exist", async () => {
    const four = [
      { run_id: "00000000-0000-4000-8000-000000000001", scenario_id: "sc", locale: "en", started_at: "2026-01-04T00:00:00.000Z", status: "DONE" },
      { run_id: "00000000-0000-4000-8000-000000000002", scenario_id: "sc", locale: "en", started_at: "2026-01-03T00:00:00.000Z", status: "DONE" },
      { run_id: "00000000-0000-4000-8000-000000000003", scenario_id: "sc", locale: "en", started_at: "2026-01-02T00:00:00.000Z", status: "DONE" },
      { run_id: "00000000-0000-4000-8000-000000000004", scenario_id: "sc", locale: "en", started_at: "2026-01-01T00:00:00.000Z", status: "DONE" },
    ];
    mockRequireUser.mockResolvedValue({
      user: { id: "u1" },
      supabase: firstPageSupabase(four, null),
      base: {},
    });
    const res = await GET(new NextRequest("http://localhost/api/arena/runs?limit=3"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.runs).toHaveLength(3);
    expect(typeof data.nextCursor).toBe("string");
    expect(data.nextCursor!.length).toBeGreaterThan(8);
  });
});
