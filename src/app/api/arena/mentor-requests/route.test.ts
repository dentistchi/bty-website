/**
 * GET /api/arena/mentor-requests — 401·403·503·200 (C4 239 Elite 큐 @contract 짝).
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockRequireAdminEmail = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireAdminEmail: (...a: unknown[]) => mockRequireAdminEmail(...a),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

function req(url = "http://localhost/api/arena/mentor-requests") {
  return new NextRequest(url);
}

describe("GET /api/arena/mentor-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when requireAdminEmail rejects (unauthenticated)", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await GET(req());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 when not admin", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden: Admin access required",
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns 503 when admin client unavailable", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true, user: { id: "a1" } });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await GET(req());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ADMIN_UNAVAILABLE");
  });

  it("returns 200 with queue shape", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true, user: { id: "a1" } });
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "r1",
                      user_id: "u1",
                      status: "pending",
                      message: null,
                      mentor_id: "m1",
                      created_at: "2026-01-01T00:00:00Z",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.queue).toHaveLength(1);
    expect(data.queue[0]).toMatchObject({
      id: "r1",
      userId: "u1",
      status: "pending",
      mentorId: "m1",
    });
  });

  it("returns 200 with scope=all without status eq (all statuses, updated_at order)", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true, user: { id: "a1" } });
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [
                  {
                    id: "r2",
                    user_id: "u2",
                    status: "approved",
                    message: null,
                    mentor_id: "m1",
                    created_at: "2026-01-02T00:00:00Z",
                    updated_at: "2026-01-03T00:00:00Z",
                    responded_at: "2026-01-03T00:00:00Z",
                  },
                ],
                error: null,
              }),
          }),
        }),
      }),
    });

    const res = await GET(req("http://localhost/api/arena/mentor-requests?scope=all"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.queue).toHaveLength(1);
    expect(data.queue[0]).toMatchObject({
      id: "r2",
      userId: "u2",
      status: "approved",
      respondedAt: "2026-01-03T00:00:00Z",
    });
  });

  /** S82 C3: Supabase elite_mentor_requests 조회 실패 → 500. */
  it("returns 500 when elite_mentor_requests query fails", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true, user: { id: "a1" } });
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "relation not found" },
                }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("relation not found");
  });
});
