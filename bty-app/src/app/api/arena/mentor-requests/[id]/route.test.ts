/**
 * PATCH /api/arena/mentor-requests/[id] — Elite 멘토 승인/거절. 401/403·400·404·500·503·200.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

const mockRequireAdminEmail = vi.fn();
const mockGetSupabaseAdmin = vi.fn();
const mockCanTransitionStatus = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireAdminEmail: (...args: unknown[]) => mockRequireAdminEmail(...args),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));
vi.mock("@/lib/bty/arena/mentorRequest", () => ({
  canTransitionStatus: (current: string, next: string) =>
    mockCanTransitionStatus(current, next),
}));

function makeRequest(body: { status: string }, id = "req-1"): NextRequest {
  return new NextRequest(`http://localhost/api/arena/mentor-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createAdminMock(
  fetchResult: { id: string; status: string } | null,
  updateResult: { data: { id: string; status: string; responded_at: string } | null; error: { message: string } | null }
) {
  let fromCallCount = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      fromCallCount += 1;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            fetchResult ? { data: fetchResult, error: null } : { data: null, error: {} }
          ),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(updateResult),
      };
    }),
  };
}

describe("PATCH /api/arena/mentor-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminEmail.mockResolvedValue({ ok: false, error: "Unauthorized", status: 401 });
    mockGetSupabaseAdmin.mockReturnValue(null);
    mockCanTransitionStatus.mockReturnValue(true);
  });

  it("returns 401 when admin auth fails", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: false, error: "Unauthorized", status: 401 });

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 when admin auth returns 403", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("returns 503 when getSupabaseAdmin returns null", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(null);

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("ADMIN_UNAVAILABLE");
  });

  it("returns 400 MISSING_ID when id is empty", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock({ id: "req-1", status: "pending" }, { data: null, error: null })
    );

    const res = await PATCH(makeRequest({ status: "approved" }, ""), {
      params: Promise.resolve({ id: "   " }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("MISSING_ID");
  });

  it("returns 400 INVALID_BODY when body is not JSON", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock({ id: "req-1", status: "pending" }, { data: null, error: null })
    );

    const req = new NextRequest("http://localhost/api/arena/mentor-requests/req-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json {",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_BODY");
  });

  it("returns 400 INVALID_STATUS when status is not approved or rejected", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock({ id: "req-1", status: "pending" }, { data: null, error: null })
    );

    const res = await PATCH(makeRequest({ status: "pending" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_STATUS");
  });

  it("returns 404 NOT_FOUND when request id does not exist", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock(null, { data: null, error: null })
    );

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-999" }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("NOT_FOUND");
  });

  it("returns 400 INVALID_TRANSITION when canTransitionStatus denies", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock({ id: "req-1", status: "approved" }, { data: null, error: null })
    );
    mockCanTransitionStatus.mockReturnValue(false);

    const res = await PATCH(makeRequest({ status: "rejected" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("INVALID_TRANSITION");
  });

  it("returns 200 with ok, id, status, respondedAt on approve success", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock(
        { id: "req-1", status: "pending" },
        {
          data: {
            id: "req-1",
            status: "approved",
            responded_at: "2026-03-14T12:00:00Z",
          },
          error: null,
        }
      )
    );

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBe("req-1");
    expect(data.status).toBe("approved");
    expect(data.respondedAt).toBe("2026-03-14T12:00:00Z");
    expect(Object.keys(data).sort()).toEqual(["id", "ok", "respondedAt", "status"].sort());
  });

  it("returns 200 on reject success", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock(
        { id: "req-1", status: "pending" },
        {
          data: {
            id: "req-1",
            status: "rejected",
            responded_at: "2026-03-14T12:00:00Z",
          },
          error: null,
        }
      )
    );

    const res = await PATCH(makeRequest({ status: "rejected" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("rejected");
    expect(Object.keys(data).sort()).toEqual(["id", "ok", "respondedAt", "status"].sort());
  });

  it("returns 500 when update fails", async () => {
    mockRequireAdminEmail.mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com", id: "a1" },
    });
    mockGetSupabaseAdmin.mockReturnValue(
      createAdminMock(
        { id: "req-1", status: "pending" },
        { data: null, error: { message: "update_failed" } }
      )
    );

    const res = await PATCH(makeRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "req-1" }),
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("update_failed");
  });
});
