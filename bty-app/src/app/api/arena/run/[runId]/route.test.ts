/**
 * GET /api/arena/run/[runId] — 401·404·200 (245 C4/C6).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetSupabaseServerClient = vi.fn();

vi.mock("@/lib/bty/arena/supabaseServer", () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

function makeClient(user: { id: string } | null, row: unknown, err: unknown) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: err }),
          }),
        }),
      }),
    }),
  };
}

describe("GET /api/arena/run/[runId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** S80 C3: empty runId → 400 MISSING_RUN_ID (before auth). */
  it("returns 400 when runId is empty", async () => {
    mockGetSupabaseServerClient.mockReturnValue(makeClient({ id: "u1" }, null, null));
    const res = await GET(new NextRequest("http://x"), {
      params: Promise.resolve({ runId: "" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("MISSING_RUN_ID");
  });

  it("401 unauthenticated", async () => {
    mockGetSupabaseServerClient.mockReturnValue(makeClient(null, null, null));
    const res = await GET(new NextRequest("http://x"), {
      params: Promise.resolve({ runId: "r1" }),
    });
    expect(res.status).toBe(401);
  });

  it("404 when no row", async () => {
    mockGetSupabaseServerClient.mockReturnValue(makeClient({ id: "u1" }, null, null));
    const res = await GET(new NextRequest("http://x"), {
      params: Promise.resolve({ runId: "missing" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
  });

  /** C6 250: trim된 runId에 해당 런 없음 → 404 NOT_FOUND. */
  it("250: 404 when trimmed runId has no row for user", async () => {
    mockGetSupabaseServerClient.mockReturnValue(makeClient({ id: "u1" }, null, null));
    const res = await GET(new NextRequest("http://x"), {
      params: Promise.resolve({ runId: "  no-such-run  " }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_FOUND");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("200 with run", async () => {
    const run = {
      run_id: "r1",
      scenario_id: "s1",
      locale: "ko",
      started_at: "2026-01-01T00:00:00Z",
      status: "started",
      completed_at: null,
      difficulty: null,
      meta: null,
    };
    mockGetSupabaseServerClient.mockReturnValue(makeClient({ id: "u1" }, run, null));
    const res = await GET(new NextRequest("http://x"), {
      params: Promise.resolve({ runId: "r1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run.run_id).toBe("r1");
  });
});
