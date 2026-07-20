/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/arena/org-memberships (Slice 3.1A-2). Admin-gated, READ-ONLY,
 * resolves display names + labels server-side and never returns raw user UUIDs.
 */

const requireAdminEmail = vi.fn();
const getSupabaseAdmin = vi.fn();
const fetchFullNameMap = vi.fn();
const listCanonical = vi.fn();

vi.mock("@/lib/authz", () => ({ requireAdminEmail: (...a: unknown[]) => requireAdminEmail(...a) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/fullNameMap.server", () => ({ fetchFullNameMap: (...a: unknown[]) => fetchFullNameMap(...a) }));
vi.mock("@/lib/bty/arena/organizationMembershipService", () => ({
  listCanonicalMembershipsForAdmin: (...a: unknown[]) => listCanonical(...a),
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const req = () => new NextRequest("http://localhost/api/admin/arena/org-memberships");

const SUMMARY = {
  approvedRequests: 1, activeCanonicalMemberships: 1, approvedWithoutCanonical: 0, canonicalWithoutApproved: 0,
  unknownJobFamily: 1, unknownPrimaryRole: 1, fullyClassified: 0, duplicateActivePrimary: 0, duplicateUserOrg: 0,
  unresolvedOrganization: 0, reconciliationStatus: "aligned" as const,
};
const MEMBERSHIPS = [{
  membershipId: "m1", userId: "secret-uuid", organizationKey: "BTY_LEGACY", organizationName: "BTY Legacy Organization",
  status: "active", isPrimary: true, jobFamilyKey: null, primaryRoleKey: null, identitySource: "legacy_approved_request",
  joinedAt: "2026-01-01T00:00:00Z", roleStartedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
}];

describe("GET org-memberships", () => {
  it("rejects unauthenticated / non-admin without loading anything", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "Forbidden", status: 403 });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(listCanonical).not.toHaveBeenCalled();
  });

  it("returns summary + memberships with labels and NO raw user UUID", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listCanonical.mockResolvedValue({ summary: SUMMARY, memberships: MEMBERSHIPS });
    fetchFullNameMap.mockResolvedValue(new Map([["secret-uuid", "Jane Doe"]]));

    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary.reconciliationStatus).toBe("aligned");
    expect(json.memberships[0]).toMatchObject({
      membershipId: "m1",
      displayName: "Jane Doe",
      jobFamilyKey: null,
      jobFamilyLabel: null,
      primaryRoleKey: null,
      primaryRoleLabel: null,
      organizationName: "BTY Legacy Organization",
    });
    // the raw user UUID must never reach the browser
    expect(JSON.stringify(json)).not.toContain("secret-uuid");
    expect(json.memberships[0]).not.toHaveProperty("userId");
  });

  it("maps known identity keys to display labels", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listCanonical.mockResolvedValue({
      summary: SUMMARY,
      memberships: [{ ...MEMBERSHIPS[0], jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "GENERAL_DENTIST" }],
    });
    fetchFullNameMap.mockResolvedValue(new Map());
    const json = await (await GET(req())).json();
    expect(json.memberships[0].jobFamilyLabel).toBe("Clinical Provider");
    expect(json.memberships[0].primaryRoleLabel).toBe("General Dentist");
  });

  it("503 when the admin client is unavailable", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue(null);
    expect((await GET(req())).status).toBe(503);
  });

  it("returns a safe 500 on service error", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue({});
    listCanonical.mockRejectedValue(new Error("db down"));
    const res = await GET(req());
    expect(res.status).toBe(500);
  });

  it("exposes no mutation verb (GET-only)", async () => {
    const mod = await import("./route");
    expect(mod).not.toHaveProperty("POST");
    expect(mod).not.toHaveProperty("PATCH");
    expect(mod).not.toHaveProperty("PUT");
    expect(mod).not.toHaveProperty("DELETE");
  });
});
