/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Slice 3.1B-1 route. Thin boundary: auth → Zod → service → status mapping. Proves the
 * admin gate holds, the audit actor cannot be forged from the body, and the wire schema
 * never accepts a user id or an organization id.
 */

const requireAdminEmail = vi.fn();
const getSupabaseAdmin = vi.fn();
const listResponsibilities = vi.fn();
const curate = vi.fn();

vi.mock("@/lib/authz", () => ({ requireAdminEmail: (...a: unknown[]) => requireAdminEmail(...a) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/organizationResponsibilityService", () => ({
  listMembershipResponsibilities: (...a: unknown[]) => listResponsibilities(...a),
  curateMembershipResponsibility: (...a: unknown[]) => curate(...a),
}));

let GET: typeof import("./route").GET;
let POST: typeof import("./route").POST;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET, POST } = await import("./route"));
});

const UUID_A = "11111111-1111-1111-1111-111111111111";
const BASE = "http://localhost/api/admin/arena/org-memberships/responsibilities";

const getReq = (qs = "") => new NextRequest(`${BASE}${qs}`);
const postReq = (body: unknown) =>
  new NextRequest(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const goodBody = { membershipId: UUID_A, responsibilityKey: "PARTNER", action: "assign", startedOn: "2020-01-01" };

describe("GET responsibilities", () => {
  it("(11) rejects a non-admin without loading anything", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });
    const res = await GET(getReq(`?membershipId=${UUID_A}`));
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(listResponsibilities).not.toHaveBeenCalled();
  });

  it("returns the canonical vocabulary with localized labels", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listResponsibilities.mockResolvedValue([]);
    const res = await GET(getReq(`?membershipId=${UUID_A}`));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.vocabulary.map((v: { key: string }) => v.key)).toEqual([
      "PARTNER",
      "CLINICAL_DIRECTOR",
      "TRAINER",
      "TEAM_LEAD",
      "PEOPLE_MANAGER",
    ]);
    // label is copy, never the key
    expect(json.vocabulary.find((v: { key: string }) => v.key === "TEAM_LEAD").label).toBe("Lead");
  });

  it("localizes labels without changing keys", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listResponsibilities.mockResolvedValue([]);
    const json = await (await GET(getReq(`?membershipId=${UUID_A}&locale=ko`))).json();
    const teamLead = json.vocabulary.find((v: { key: string }) => v.key === "TEAM_LEAD");
    expect(teamLead.key).toBe("TEAM_LEAD");
    expect(teamLead.label).toBe("리드");
  });

  it("(3) returns the membership's active assignments for reload persistence", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listResponsibilities.mockResolvedValue([
      { id: "r1", responsibilityKey: "PARTNER", startedOn: "2020-01-01" },
      { id: "r2", responsibilityKey: "PEOPLE_MANAGER", startedOn: null },
    ]);
    const json = await (await GET(getReq(`?membershipId=${UUID_A}`))).json();
    expect(json.responsibilities).toHaveLength(2);
    expect(json.responsibilities[1].startedOn).toBeNull();
  });
});

describe("POST responsibilities", () => {
  beforeEach(() => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { id: "admin-1", email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
  });

  it("(11) rejects a non-admin before touching the service", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden: Admin access required", status: 403 });
    const res = await POST(postReq(goodBody));
    expect(res.status).toBe(403);
    expect(curate).not.toHaveBeenCalled();
  });

  it("maps every rejection reason to its status", async () => {
    const cases: Array<[string, number]> = [
      ["invalid_responsibility", 400],
      ["invalid_action", 400],
      ["start_date_not_a_date", 400],
      ["start_date_in_future", 400],
      ["member_out_of_scope", 403],
      ["membership_not_found", 404],
      ["organization_membership_inactive", 409],
      ["responsibility_already_active", 409],
      ["responsibility_not_active", 409],
      ["write_failed", 500],
    ];
    for (const [reason, status] of cases) {
      curate.mockResolvedValueOnce({ ok: false, reason });
      const res = await POST(postReq(goodBody));
      expect(res.status, `reason=${reason}`).toBe(status);
    }
  });

  it("derives the actor from the session — a body-supplied actor is ignored", async () => {
    curate.mockResolvedValue({ ok: true, responsibilityKey: "PARTNER", action: "assign", before: {}, after: {} });
    await POST(postReq({ ...goodBody, changedBy: "attacker", p_changed_by: "attacker" }));
    const arg = curate.mock.calls[0][1] as Record<string, unknown>;
    expect(arg.changedBy).toBe("admin-1");
    expect(arg).not.toHaveProperty("p_changed_by");
  });

  it("strips a body-supplied user id or organization id — membership is the only address", async () => {
    curate.mockResolvedValue({ ok: true, responsibilityKey: "PARTNER", action: "assign", before: {}, after: {} });
    await POST(postReq({ ...goodBody, userId: "attacker", organizationId: "org-elsewhere" }));
    const arg = curate.mock.calls[0][1] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("userId");
    expect(arg).not.toHaveProperty("organizationId");
    expect(Object.keys(arg).sort()).toEqual(
      ["action", "changedBy", "membershipId", "responsibilityKey", "startedOn", "todayISO"].sort(),
    );
  });

  it("rejects a malformed action at the wire boundary", async () => {
    const res = await POST(postReq({ ...goodBody, action: "delete" }));
    expect(res.status).toBe(400);
    expect(curate).not.toHaveBeenCalled();
  });

  it("rejects a payload with no membershipId (a user id is never an accepted address)", async () => {
    const { membershipId: _drop, ...noMembership } = goodBody;
    const res = await POST(postReq({ ...noMembership, userId: UUID_A }));
    expect(res.status).toBe(400);
    expect(curate).not.toHaveBeenCalled();
  });

  it("passes an unknown date through as null, never as a string", async () => {
    curate.mockResolvedValue({ ok: true, responsibilityKey: "PARTNER", action: "assign", before: {}, after: {} });
    await POST(postReq({ ...goodBody, startedOn: null }));
    expect((curate.mock.calls[0][1] as Record<string, unknown>).startedOn).toBeNull();
  });

  it("503 when the admin client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect((await POST(postReq(goodBody))).status).toBe(503);
  });
});
