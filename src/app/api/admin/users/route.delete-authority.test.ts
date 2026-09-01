import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Legitimate admin user management stays exactly as it was (Slice P0-R1).
 *
 * P0 contained the DEV/TEST paths. This route is neither: it is a real production admin feature
 * behind Entra RBAC, and the directive is explicit that it must keep working. These tests exist to
 * pin the two properties that make it safe to leave alone — it requires admin authorization, and
 * one request deletes at most one user — so a later change cannot quietly turn it into the bulk
 * delete that this incident looked like.
 */

const mockRequireAdminEmail = vi.fn();
const mockDeleteUser = vi.fn();
const mockListUsers = vi.fn();

vi.mock("@/lib/require-admin", () => ({
  requireAdminEmail: (...a: unknown[]) => mockRequireAdminEmail(...a),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { deleteUser: (...a: unknown[]) => mockDeleteUser(...a), listUsers: (...a: unknown[]) => mockListUsers(...a) } },
  }),
}));

function req(query: string) {
  const url = `http://localhost/api/admin/users${query}`;
  return { nextUrl: new URL(url), url } as unknown as import("next/server").NextRequest;
}

describe("DELETE /api/admin/users — authorization unchanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteUser.mockResolvedValue({ error: null });
    mockListUsers.mockResolvedValue({ data: { users: [] } });
  });

  it("refuses a non-admin caller and never reaches deleteUser", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    const { DELETE } = await import("./route");

    const res = await DELETE(req("?id=11111111-1111-1111-1111-111111111111"));

    expect(res.status).toBe(403);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes AT MOST ONE user per request", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true });
    const { DELETE } = await import("./route");

    const res = await DELETE(req("?id=11111111-1111-1111-1111-111111111111"));

    expect(res.status).toBe(200);
    // The property that matters: one call, with one id. There is no list-and-loop path here.
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("requires a target — no id and no email deletes nothing", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true });
    const { DELETE } = await import("./route");

    const res = await DELETE(req(""));

    expect(res.status).toBe(400);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("an email that matches no user deletes nothing", async () => {
    mockRequireAdminEmail.mockResolvedValue({ ok: true });
    mockListUsers.mockResolvedValue({ data: { users: [{ id: "other", email: "someone@else.com" }] } });
    const { DELETE } = await import("./route");

    const res = await DELETE(req("?email=absent%40example.com"));

    expect(res.status).toBe(404);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
