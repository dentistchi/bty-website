/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveManageableOrganizations,
  curateMembershipIdentity,
} from "./organizationMembershipService";

/**
 * Slice 3.1A-3 (post-correction) — server-authoritative curation that PRESERVES memberships.
 * Proves the service NEVER trusts the caller (cross-org id injection, out-of-scope members,
 * invalid pairs, future dates) AND that curation resolves the target user privately, calls
 * the RPC keyed by (user, selected org), never sends an organization-change, and maps the
 * organization_membership_missing rejection.
 */

const ORG_A = { id: "org-a", organization_key: "BTY_LEGACY", display_name: "BTY Legacy", enterprise_id: "ent-1", status: "active" };
const ORG_B = { id: "org-b", organization_key: "BTY_DSO2", display_name: "Second Org", enterprise_id: "ent-1", status: "active" };

function makeAdmin(opts: {
  orgs?: Array<Record<string, unknown>>;
  anchor?: { id: string; user_id: string; organization_id: string } | null;
  rpcResult?: { data: unknown; error: { message: string } | null };
  rpcSpy?: (name: string, params: Record<string, unknown>) => void;
}): SupabaseClient {
  const orgs = opts.orgs ?? [ORG_A];
  const anchor = opts.anchor === undefined ? { id: "m1", user_id: "user-1", organization_id: "org-a" } : opts.anchor;
  return {
    from(table: string) {
      if (table === "bty_organizations") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          order: () => Promise.resolve({ data: orgs, error: null }),
        };
        return q;
      }
      if (table === "bty_org_memberships") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          maybeSingle: () => Promise.resolve({ data: anchor, error: null }),
        };
        return q;
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      opts.rpcSpy?.(name, params);
      return Promise.resolve(
        opts.rpcResult ?? {
          data: [
            {
              prev_organization_id: params.p_organization_id,
              prev_job_family_key: null,
              prev_primary_role_key: null,
              prev_role_started_on: null,
              prev_is_primary: true,
              new_organization_id: params.p_organization_id,
              new_job_family_key: params.p_job_family_key,
              new_primary_role_key: params.p_primary_role_key,
              new_role_started_on: params.p_role_started_on,
              new_is_primary: true,
            },
          ],
          error: null,
        },
      );
    },
  } as unknown as SupabaseClient;
}

const base = {
  membershipId: "m1",
  organizationId: "org-a",
  jobFamilyKey: "CLINICAL_PROVIDER" as string | null,
  primaryRoleKey: "GENERAL_DENTIST" as string | null,
  roleStartedOn: "2020-05-01" as string | null,
  changedBy: "admin-1",
  todayISO: "2026-07-19",
};

describe("resolveManageableOrganizations", () => {
  it("maps active orgs to option shape", async () => {
    const admin = makeAdmin({ orgs: [ORG_A, ORG_B] });
    const out = await resolveManageableOrganizations(admin);
    expect(out).toEqual([
      { id: "org-a", organizationKey: "BTY_LEGACY", displayName: "BTY Legacy", enterpriseId: "ent-1" },
      { id: "org-b", organizationKey: "BTY_DSO2", displayName: "Second Org", enterpriseId: "ent-1" },
    ]);
  });
});

describe("curateMembershipIdentity (membership-preserving)", () => {
  it("curates the user's existing membership and returns before/after", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    const res = await curateMembershipIdentity(admin, base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.after.jobFamilyKey).toBe("CLINICAL_PROVIDER");
      expect(res.after.primaryRoleKey).toBe("GENERAL_DENTIST");
      expect(res.after.isPrimary).toBe(true);
      // organization is unchanged (in == out) — curation never repoints the row
      expect(res.after.organizationId).toBe(res.before.organizationId);
    }
    // RPC is keyed by the privately-resolved USER + selected org; changed_by = admin.
    expect(rpcSpy).toHaveBeenCalledWith(
      "bty_curate_membership_identity",
      expect.objectContaining({ p_user_id: "user-1", p_organization_id: "org-a", p_changed_by: "admin-1" }),
    );
  });

  it("never passes an organization-change parameter to the RPC", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    await curateMembershipIdentity(admin, base);
    const params = rpcSpy.mock.calls[0][1];
    // the only org param is the SELECT key; there is no new/target org field.
    expect(params).not.toHaveProperty("p_new_organization_id");
    expect(params).not.toHaveProperty("p_target_organization_id");
    expect(Object.keys(params)).toEqual([
      "p_user_id",
      "p_organization_id",
      "p_job_family_key",
      "p_primary_role_key",
      "p_role_started_on",
      "p_changed_by",
    ]);
  });

  it("persists unknown role date as null (YYYY-MM-DD or null, no timestamp)", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    const res = await curateMembershipIdentity(admin, { ...base, roleStartedOn: null });
    expect(res.ok).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith(
      "bty_curate_membership_identity",
      expect.objectContaining({ p_role_started_on: null }),
    );
  });

  it("forwards a calendar date unchanged (no timezone conversion)", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    await curateMembershipIdentity(admin, { ...base, roleStartedOn: "2026-07-01" });
    expect(rpcSpy).toHaveBeenCalledWith(
      "bty_curate_membership_identity",
      expect.objectContaining({ p_role_started_on: "2026-07-01" }),
    );
  });

  it("rejects an incompatible (family, role) pair before any DB write", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    const res = await curateMembershipIdentity(admin, { ...base, jobFamilyKey: "SHARED_SERVICES" });
    expect(res).toEqual({ ok: false, reason: "incompatible" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects a role date in the future before any DB write", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ rpcSpy });
    const res = await curateMembershipIdentity(admin, { ...base, roleStartedOn: "2030-01-01" });
    expect(res).toEqual({ ok: false, reason: "role_date_in_future" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects a cross-organization id injection (org not manageable)", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ orgs: [ORG_A], rpcSpy });
    const res = await curateMembershipIdentity(admin, { ...base, organizationId: "org-evil" });
    expect(res).toEqual({ ok: false, reason: "organization_not_manageable" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("rejects a member whose anchor org is out of the admin's scope", async () => {
    const rpcSpy = vi.fn();
    const admin = makeAdmin({ orgs: [ORG_A], anchor: { id: "m1", user_id: "user-1", organization_id: "org-b" }, rpcSpy });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toEqual({ ok: false, reason: "member_out_of_scope" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("returns membership_not_found when the anchor membership does not exist", async () => {
    const admin = makeAdmin({ anchor: null });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toEqual({ ok: false, reason: "membership_not_found" });
  });

  it("maps organization_membership_missing (user has no membership in the selected org)", async () => {
    const admin = makeAdmin({ rpcResult: { data: null, error: { message: "organization_membership_missing" } } });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toEqual({ ok: false, reason: "organization_membership_missing" });
  });

  // --- Active-target enforcement (correction 2) -----------------------------

  it("maps organization_membership_inactive to its own distinct reason, not to 'missing'", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: 'raise exception "organization_membership_inactive"' } },
    });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toEqual({ ok: false, reason: "organization_membership_inactive" });
  });

  it("does not confuse the inactive and missing reasons in either direction", async () => {
    const inactive = await curateMembershipIdentity(
      makeAdmin({ rpcResult: { data: null, error: { message: "organization_membership_inactive" } } }),
      base,
    );
    const missing = await curateMembershipIdentity(
      makeAdmin({ rpcResult: { data: null, error: { message: "organization_membership_missing" } } }),
      base,
    );
    expect(inactive).toEqual({ ok: false, reason: "organization_membership_inactive" });
    expect(missing).toEqual({ ok: false, reason: "organization_membership_missing" });
  });

  it("reports an inactive rejection as a clean failure — no partial success payload", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: "organization_membership_inactive" } },
    });
    const res = await curateMembershipIdentity(admin, base);
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty("before");
    expect(res).not.toHaveProperty("after");
  });

  // --- Concurrency conflict (correction 1) ---------------------------------

  it("maps the single-primary race to primary_membership_conflict, not write_failed", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: 'raise exception "primary_membership_conflict"' } },
    });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toEqual({ ok: false, reason: "primary_membership_conflict" });
  });

  it("still surfaces an UNRELATED unique violation as write_failed (never silently retried)", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: 'duplicate key value violates unique constraint "some_other_idx"' } },
    });
    const res = await curateMembershipIdentity(admin, base);
    expect(res).toMatchObject({ ok: false, reason: "write_failed" });
  });

  // --- Actor / target derivation (correction 4) -----------------------------

  it("derives p_user_id from the anchor membership — never from caller input", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const admin = makeAdmin({
      anchor: { id: "m1", user_id: "target-user-from-anchor", organization_id: "org-a" },
      rpcSpy: (_n, p) => calls.push(p),
    });
    // A forged user id on the input object must be ignored entirely.
    await curateMembershipIdentity(admin, { ...base, userId: "attacker-supplied" } as never);
    expect(calls[0].p_user_id).toBe("target-user-from-anchor");
    expect(calls[0].p_user_id).not.toBe("attacker-supplied");
  });

  it("passes the authenticated admin as p_changed_by — the audit actor cannot be forged", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const admin = makeAdmin({ rpcSpy: (_n, p) => calls.push(p) });
    await curateMembershipIdentity(admin, { ...base, changedBy: "admin-1" });
    expect(calls[0].p_changed_by).toBe("admin-1");
    // and it is never taken from the target user
    expect(calls[0].p_changed_by).not.toBe(calls[0].p_user_id);
  });
});
