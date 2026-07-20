/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Slice 3.1B-2 preview route. Proves the Foundry Host gate holds, that the caller can
 * never supply or widen the organization scope, and that eligibility is a read-only
 * preview that assigns nothing.
 */

const requireUser = vi.fn();
const getSupabaseAdmin = vi.fn();
const isActiveFoundryHost = vi.fn();
const resolveLeaderEligibility = vi.fn();
const resolveOwnOrganizationId = vi.fn();
const fetchFullNameMap = vi.fn();

vi.mock("@/lib/authz", () => ({ requireUser: (...a: unknown[]) => requireUser(...a) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/foundry/events/foundryHostService", () => ({
  isActiveFoundryHost: (...a: unknown[]) => isActiveFoundryHost(...a),
}));
vi.mock("@/lib/bty/arena/organizationResponsibilityService", () => ({
  resolveLeaderEligibility: (...a: unknown[]) => resolveLeaderEligibility(...a),
  resolveOwnOrganizationId: (...a: unknown[]) => resolveOwnOrganizationId(...a),
}));
vi.mock("@/lib/bty/arena/fullNameMap.server", () => ({
  fetchFullNameMap: (...a: unknown[]) => fetchFullNameMap(...a),
}));

let GET: typeof import("./route").GET;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ GET } = await import("./route"));
});

const BASE = "http://localhost/api/bty/foundry/audience/leaders-preview";
const req = (qs = "") => new NextRequest(`${BASE}${qs}`);

function membershipSelect(rows: Array<{ id: string; user_id: string }>) {
  const q: Record<string, unknown> = {
    select: () => q,
    in: () => Promise.resolve({ data: rows, error: null }),
  };
  return { from: () => q };
}

describe("GET leaders-preview — authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    requireUser.mockResolvedValue({ ok: false, error: "Unauthorized", status: 401 });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects an authenticated NON-Host (eligibility is not a public read)", async () => {
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
    getSupabaseAdmin.mockReturnValue({});
    isActiveFoundryHost.mockResolvedValue(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(resolveLeaderEligibility).not.toHaveBeenCalled();
  });
});

describe("GET leaders-preview — scope + contract", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ ok: true, user: { id: "host-1" } });
    isActiveFoundryHost.mockResolvedValue(true);
    fetchFullNameMap.mockResolvedValue(new Map([["u-hanbit", "Hanbit Chi"]]));
  });

  it("resolves the organization SERVER-side and ignores a client-supplied one", async () => {
    getSupabaseAdmin.mockReturnValue(membershipSelect([{ id: "m1", user_id: "u-hanbit" }]));
    resolveOwnOrganizationId.mockResolvedValue("org-a");
    resolveLeaderEligibility.mockResolvedValue({
      organizationId: "org-a",
      eligibleCount: 1,
      members: [{ membershipId: "m1", displayName: null, matchedResponsibilityKeys: ["PARTNER"] }],
    });

    // caller attempts to widen/cross scope via query params
    const res = await GET(req("?organizationId=org-ELSEWHERE&membershipIds=m9,m8"));
    const json = await res.json();

    expect(res.status).toBe(200);
    // scope came from the caller's OWN membership, not the query string
    expect(resolveOwnOrganizationId).toHaveBeenCalledWith(expect.anything(), "host-1");
    expect(resolveLeaderEligibility).toHaveBeenCalledWith(expect.anything(), "org-a");
    expect(json.eligibleCount).toBe(1);
    expect(json.members).toEqual([{ membershipId: "m1", displayName: "Hanbit Chi" }]);
  });

  it("declares itself a preview that assigns nothing", async () => {
    getSupabaseAdmin.mockReturnValue(membershipSelect([]));
    resolveOwnOrganizationId.mockResolvedValue("org-a");
    resolveLeaderEligibility.mockResolvedValue({ organizationId: "org-a", eligibleCount: 0, members: [] });
    const json = await (await GET(req())).json();
    expect(json.preview).toBe(true);
    expect(json.assigns).toBe(false);
  });

  it("returns zero — never a member list — when nobody qualifies", async () => {
    getSupabaseAdmin.mockReturnValue(membershipSelect([]));
    resolveOwnOrganizationId.mockResolvedValue("org-a");
    resolveLeaderEligibility.mockResolvedValue({ organizationId: "org-a", eligibleCount: 0, members: [] });
    const json = await (await GET(req())).json();
    expect(json.eligibleCount).toBe(0);
    expect(json.members).toEqual([]);
  });

  it("returns an empty preview when the host has no canonical membership", async () => {
    getSupabaseAdmin.mockReturnValue(membershipSelect([]));
    resolveOwnOrganizationId.mockResolvedValue(null);
    const json = await (await GET(req())).json();
    expect(json.eligibleCount).toBe(0);
    expect(resolveLeaderEligibility).not.toHaveBeenCalled();
  });

  it("never returns raw user UUIDs to the browser", async () => {
    getSupabaseAdmin.mockReturnValue(membershipSelect([{ id: "m1", user_id: "u-hanbit" }]));
    resolveOwnOrganizationId.mockResolvedValue("org-a");
    resolveLeaderEligibility.mockResolvedValue({
      organizationId: "org-a",
      eligibleCount: 1,
      members: [{ membershipId: "m1", displayName: null, matchedResponsibilityKeys: ["PARTNER"] }],
    });
    const body = JSON.stringify(await (await GET(req())).json());
    expect(body).not.toContain("u-hanbit");
  });

  it("503 when the admin client is unavailable", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect((await GET(req())).status).toBe(503);
  });
});
