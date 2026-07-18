/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Approve route write-through (Slice 3.1A-1). Approval remains the sole access authority;
 * canonical membership is written best-effort AFTER approval and never blocks it. The
 * approve route must not write the legacy `memberships` table (it calls the canonical
 * service only).
 */

const requireAdminEmail = vi.fn();
const getSupabaseAdmin = vi.fn();
const ensureCanonical = vi.fn();

vi.mock("@/lib/authz", () => ({ requireAdminEmail: (...a: unknown[]) => requireAdminEmail(...a) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/bty/arena/organizationMembershipService", () => ({
  ensureCanonicalMembershipFromApproval: (...a: unknown[]) => ensureCanonical(...a),
}));

let PATCH: typeof import("./route").PATCH;
beforeEach(async () => {
  vi.clearAllMocks();
  ({ PATCH } = await import("./route"));
});

/** Fake admin whose update-chain resolves to a preset {data,error}. */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {
    update() { return b; },
    eq() { return b; },
    select() { return b; },
    single() { return Promise.resolve(result); },
  };
  return { from: () => b };
}

const req = () => new NextRequest("http://localhost/x", { method: "PATCH" });
const params = { params: Promise.resolve({ id: "7" }) };

describe("PATCH approve — canonical write-through", () => {
  it("approves, then writes canonical membership with the approved user's data", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "Admin@x.com" } });
    getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { id: 7, user_id: "u7", status: "approved", joined_at: "2026-02-02" }, error: null }));
    ensureCanonical.mockResolvedValue({ ok: true, created: true, reason: "created" });

    const res = await PATCH(req(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, userId: "u7", canonicalMembership: "ok" });
    expect(ensureCanonical).toHaveBeenCalledWith(expect.anything(), {
      userId: "u7",
      joinedAt: "2026-02-02",
      sourceRequestId: 7,
    });
  });

  it("a canonical-write miss does NOT block the approval (access preserved)", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: { id: 7, user_id: "u7", status: "approved", joined_at: null }, error: null }));
    ensureCanonical.mockResolvedValue({ ok: false, reason: "write_failed", detail: "boom" });

    const res = await PATCH(req(), params);
    expect(res.status).toBe(200); // approval still succeeds
    expect((await res.json()).canonicalMembership).toBe("reconciliation_pending");
  });

  it("does NOT write canonical membership when nothing was approved (404)", async () => {
    requireAdminEmail.mockResolvedValue({ ok: true, user: { email: "a@x.com" } });
    getSupabaseAdmin.mockReturnValue(fakeAdmin({ data: null, error: null })); // already approved / not found
    const res = await PATCH(req(), params);
    expect(res.status).toBe(404);
    expect(ensureCanonical).not.toHaveBeenCalled();
  });

  it("rejects a non-admin without touching anything", async () => {
    requireAdminEmail.mockResolvedValue({ ok: false, error: "FORBIDDEN", status: 403 });
    const res = await PATCH(req(), params);
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(ensureCanonical).not.toHaveBeenCalled();
  });
});
