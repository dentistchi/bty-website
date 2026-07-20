/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST/GET /api/admin/arena/org-memberships/curate (Slice 3.1A-3). Admin-gated write. The
 * route is a thin boundary: auth → Zod → service → status mapping. Business authority lives
 * in the service + RPC, so these tests assert gating, validation, and reason→status mapping.
 */

const requireAdminEmail = vi.fn();
const getSupabaseAdmin = vi.fn();
const resolveManageable = vi.fn();
const curate = vi.fn();

vi.mock("@/lib/authz", () => ({ requireAdminEmail: (...a: unknown[]) => requireAdminEmail(...a) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/organizationMembershipService", () => ({
  resolveManageableOrganizations: (...a: unknown[]) => resolveManageable(...a),
  curateMembershipIdentity: (...a: unknown[]) => curate(...a),
}));

let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET, POST } = await import("./route"));
});

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

const getReq = () => new NextRequest("http://localhost/api/admin/arena/org-memberships/curate");
const postReq = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/arena/org-memberships/curate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const goodBody = {
  membershipId: UUID_A,
  organizationId: UUID_B,
  jobFamilyKey: "CLINICAL_PROVIDER",
  primaryRoleKey: "GENERAL_DENTIST",
  roleStartedOn: "2020-05-01",
};

describe("GET curate (editor reference data)", () => {
  it("rejects non-admin without loading anything", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns manageable orgs + full taxonomy with labels and role→family", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    resolveManageable.mockResolvedValue([
      { id: UUID_B, organizationKey: "BTY_LEGACY", displayName: "BTY Legacy", enterpriseId: "e1" },
    ]);
    const json = await (await GET(getReq())).json();
    expect(json.ok).toBe(true);
    expect(json.organizations).toHaveLength(1);
    expect(json.taxonomy.jobFamilies).toEqual(
      expect.arrayContaining([{ key: "CLINICAL_PROVIDER", label: "Clinical Provider" }]),
    );
    expect(json.taxonomy.primaryRoles).toEqual(
      expect.arrayContaining([
        { key: "GENERAL_DENTIST", label: "General Dentist", familyKey: "CLINICAL_PROVIDER" },
      ]),
    );
  });
});

describe("POST curate", () => {
  it("rejects non-admin without calling the service", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });
    const res = await POST(postReq(goodBody));
    expect(res.status).toBe(403);
    expect(curate).not.toHaveBeenCalled();
  });

  it("400s a malformed body (non-uuid) without calling the service", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    const res = await POST(postReq({ ...goodBody, membershipId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(curate).not.toHaveBeenCalled();
  });

  it("forwards the authenticated admin id as changedBy and succeeds", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    curate.mockResolvedValue({
      ok: true,
      before: { organizationId: UUID_B, jobFamilyKey: null, primaryRoleKey: null, roleStartedAt: null },
      after: { organizationId: UUID_B, jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "GENERAL_DENTIST", roleStartedAt: "2020-05-01T00:00:00Z" },
    });
    const res = await POST(postReq(goodBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(curate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ changedBy: "admin-1", membershipId: UUID_A, roleStartedOn: "2020-05-01" }),
    );
    // never returns a raw user id
    expect(json).not.toHaveProperty("userId");
  });

  it("maps service reasons to HTTP status", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    const cases: Array<[string, number]> = [
      ["incompatible", 400],
      ["role_date_in_future", 400],
      ["organization_not_manageable", 403],
      ["member_out_of_scope", 403],
      ["membership_not_found", 404],
      ["organization_membership_missing", 409],
      ["organization_membership_inactive", 409],
      ["primary_membership_conflict", 409],
      ["write_failed", 500],
    ];
    for (const [reason, status] of cases) {
      curate.mockResolvedValueOnce({ ok: false, reason });
      const res = await POST(postReq(goodBody));
      expect(res.status, `reason=${reason}`).toBe(status);
    }
  });

  it("503 when the admin client is unavailable", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue(null);
    expect((await POST(postReq(goodBody))).status).toBe(503);
  });
});

/**
 * Actor / target forgery surface (correction 4). The wire schema is the security boundary:
 * the browser addresses a MEMBERSHIP, never a user, and never the audit actor.
 */
describe("POST curate — payload schema cannot forge the target user or the audit actor", () => {
  beforeEach(() => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    curate.mockResolvedValue({ ok: true, before: {}, after: {} });
  });

  it("strips a browser-supplied userId / p_user_id — never forwarded to the service", async () => {
    await POST(postReq({ ...goodBody, userId: "attacker", p_user_id: "attacker" }));
    const arg = curate.mock.calls[0][1] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("userId");
    expect(arg).not.toHaveProperty("p_user_id");
  });

  it("strips a browser-supplied changedBy / changed_by and uses the authenticated admin", async () => {
    await POST(postReq({ ...goodBody, changedBy: "attacker", changed_by: "attacker" }));
    const arg = curate.mock.calls[0][1] as Record<string, unknown>;
    expect(arg.changedBy).toBe("admin-1");
    expect(arg).not.toHaveProperty("changed_by");
  });

  it("forwards ONLY the membership-addressed identity fields plus server-derived context", async () => {
    await POST(postReq(goodBody));
    const arg = curate.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(arg).sort()).toEqual(
      ["changedBy", "jobFamilyKey", "membershipId", "organizationId", "primaryRoleKey", "roleStartedOn", "todayISO"].sort(),
    );
  });

  it("derives the actor from auth context, so two different admins produce different actors", async () => {
    await POST(postReq(goodBody));
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-2", email: "b@x.com" } });
    await POST(postReq(goodBody));
    expect((curate.mock.calls[0][1] as Record<string, unknown>).changedBy).toBe("admin-1");
    expect((curate.mock.calls[1][1] as Record<string, unknown>).changedBy).toBe("admin-2");
  });

  it("rejects a payload that omits membershipId (a user id is never an accepted address)", async () => {
    const { membershipId: _drop, ...noMembership } = goodBody;
    const res = await POST(postReq({ ...noMembership, userId: UUID_A }));
    expect(res.status).toBe(400);
    expect(curate).not.toHaveBeenCalled();
  });
});
