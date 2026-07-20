import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureCanonicalMembershipFromApproval,
  reconciliationStatus,
  validateProfessionalIdentity,
  listCanonicalMembershipsForAdmin,
} from "./organizationMembershipService";

/**
 * Canonical membership service (Slice 3.1A-1). Verifies the write-through is idempotent,
 * curation-safe, never guesses identity, and never touches the legacy `memberships` table.
 */

type Cfg = {
  enterprise?: { id: string } | null;
  org?: { id: string; organization_key: string } | null;
  activePrimary?: { id: string } | null;
  legacyRow?: { id: string } | null;
  insertError?: { message: string } | null;
  counts?: Record<string, number>;
};

function makeAdmin(cfg: Cfg) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const touched = new Set<string>();
  function builder(table: string) {
    touched.add(table);
    let columns = "";
    const filters: Record<string, unknown> = {};
    const b: Record<string, unknown> = {
      select(cols: string) {
        columns = cols;
        return b;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return b;
      },
      insert(row: Record<string, unknown>) {
        inserts.push({ table, row });
        return Promise.resolve({ error: cfg.insertError ?? null });
      },
      maybeSingle() {
        let data: unknown = null;
        if (table === "bty_enterprises") data = cfg.enterprise ?? null;
        else if (table === "bty_organizations") data = cfg.org ?? null;
        else if (table === "bty_org_memberships") data = columns === "id" ? (cfg.legacyRow ?? null) : (cfg.activePrimary ?? null);
        return Promise.resolve({ data });
      },
      then(onF: (v: unknown) => unknown) {
        // reconciliationStatus awaits the builder directly (count/head)
        return Promise.resolve({ count: cfg.counts?.[table] ?? 0, error: null }).then(onF);
      },
    };
    return b;
  }
  const admin = { from: (t: string) => builder(t) } as unknown as SupabaseClient;
  return { admin, inserts, touched };
}

const OK_ORG = { enterprise: { id: "ent1" }, org: { id: "org_legacy", organization_key: "BTY_LEGACY" } };

describe("ensureCanonicalMembershipFromApproval", () => {
  it("fails closed when the bootstrap org is missing (never guesses an org)", async () => {
    const { admin, inserts } = makeAdmin({ enterprise: null, org: null });
    const r = await ensureCanonicalMembershipFromApproval(admin, { userId: "u1" });
    expect(r).toEqual({ ok: false, reason: "bootstrap_org_missing" });
    expect(inserts).toHaveLength(0);
  });

  it("does nothing when the user already has an active primary membership (curation-safe)", async () => {
    const { admin, inserts } = makeAdmin({ ...OK_ORG, activePrimary: { id: "m_existing" } });
    const r = await ensureCanonicalMembershipFromApproval(admin, { userId: "u1" });
    expect(r).toEqual({ ok: true, created: false, reason: "already_primary" });
    expect(inserts).toHaveLength(0);
  });

  it("preserves a pre-existing BTY_LEGACY row instead of inserting a duplicate", async () => {
    const { admin, inserts } = makeAdmin({ ...OK_ORG, activePrimary: null, legacyRow: { id: "m_legacy" } });
    const r = await ensureCanonicalMembershipFromApproval(admin, { userId: "u1" });
    expect(r).toEqual({ ok: true, created: false, reason: "already_in_legacy" });
    expect(inserts).toHaveLength(0);
  });

  it("inserts one active primary BTY_LEGACY membership with UNKNOWN identity", async () => {
    const { admin, inserts, touched } = makeAdmin({ ...OK_ORG, activePrimary: null, legacyRow: null });
    const r = await ensureCanonicalMembershipFromApproval(admin, {
      userId: "u1",
      joinedAt: "2026-01-01",
      sourceRequestId: 42,
    });
    expect(r).toEqual({ ok: true, created: true, reason: "created" });
    expect(inserts).toHaveLength(1);
    const row = inserts[0].row;
    expect(inserts[0].table).toBe("bty_org_memberships");
    expect(row).toMatchObject({
      user_id: "u1",
      organization_id: "org_legacy",
      status: "active",
      is_primary: true,
      joined_at: "2026-01-01",
      job_family_key: null,
      primary_role_key: null,
      role_started_at: null,
      identity_source: "membership_approval",
      source_membership_request_id: 42,
    });
    // never touches the legacy `memberships` table
    expect(touched.has("memberships")).toBe(false);
  });

  it("treats a unique-constraint race as an idempotent success", async () => {
    const { admin } = makeAdmin({ ...OK_ORG, activePrimary: null, legacyRow: null, insertError: { message: 'duplicate key value violates unique constraint' } });
    const r = await ensureCanonicalMembershipFromApproval(admin, { userId: "u1" });
    expect(r).toEqual({ ok: true, created: false, reason: "already_in_legacy" });
  });

  it("reports a genuine write failure honestly (does not claim success)", async () => {
    const { admin } = makeAdmin({ ...OK_ORG, activePrimary: null, legacyRow: null, insertError: { message: "connection reset" } });
    const r = await ensureCanonicalMembershipFromApproval(admin, { userId: "u1" });
    expect(r).toEqual({ ok: false, reason: "write_failed", detail: "connection reset" });
  });
});

describe("reconciliationStatus", () => {
  it("returns aggregate approved vs canonical-active counts (no rows)", async () => {
    const { admin } = makeAdmin({ counts: { arena_membership_requests: 24, bty_org_memberships: 20 } });
    const r = await reconciliationStatus(admin);
    expect(r).toEqual({ approvedRequests: 24, canonicalActive: 20 });
  });
});

describe("validateProfessionalIdentity (future admin-curation guard)", () => {
  it("allows fully-unknown identity", () => {
    expect(validateProfessionalIdentity({})).toEqual({ ok: true });
    expect(validateProfessionalIdentity({ jobFamilyKey: null, primaryRoleKey: null })).toEqual({ ok: true });
  });
  it("rejects invalid keys and incompatible pairs", () => {
    expect(validateProfessionalIdentity({ jobFamilyKey: "leader" })).toEqual({ ok: false, reason: "invalid_family" });
    expect(validateProfessionalIdentity({ primaryRoleKey: "BOSS" })).toEqual({ ok: false, reason: "invalid_role" });
    expect(validateProfessionalIdentity({ jobFamilyKey: "CLINICAL_SUPPORT", primaryRoleKey: "GENERAL_DENTIST" })).toEqual({ ok: false, reason: "incompatible" });
  });
  it("accepts a compatible pair", () => {
    expect(validateProfessionalIdentity({ jobFamilyKey: "CLINICAL_PROVIDER", primaryRoleKey: "GENERAL_DENTIST" })).toEqual({ ok: true });
  });
});

// -- Slice 3.1A-2: admin READ surface ------------------------------------------------
type ListCfg = {
  memberships?: Record<string, unknown>[];
  orgs?: { id: string; organization_key: string; display_name: string }[];
  approved?: { user_id: string }[];
};

function makeListAdmin(cfg: ListCfg) {
  const touched = new Set<string>();
  function builder(table: string) {
    touched.add(table);
    const b: Record<string, unknown> = {
      select() { return b; },
      eq() { return b; },
      then(onF: (v: unknown) => unknown) {
        let data: unknown[] = [];
        if (table === "bty_org_memberships") data = cfg.memberships ?? [];
        else if (table === "bty_organizations") data = cfg.orgs ?? [];
        else if (table === "arena_membership_requests") data = cfg.approved ?? [];
        return Promise.resolve({ data, error: null }).then(onF);
      },
    };
    return b;
  }
  const admin = { from: (t: string) => builder(t) } as unknown as import("@supabase/supabase-js").SupabaseClient;
  return { admin, touched };
}

const ORG = { id: "org1", organization_key: "BTY_LEGACY", display_name: "BTY Legacy Organization" };
function mem(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m1", user_id: "u1", organization_id: "org1", status: "active", is_primary: true,
    job_family_key: null, primary_role_key: null, role_started_at: null,
    identity_source: "legacy_approved_request", joined_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...over,
  };
}

describe("listCanonicalMembershipsForAdmin", () => {
  it("resolves org + returns nullable identity honestly, aligned when reconciled", async () => {
    const { admin, touched } = makeListAdmin({
      orgs: [ORG],
      memberships: [mem({ id: "m1", user_id: "u1" }), mem({ id: "m2", user_id: "u2" })],
      approved: [{ user_id: "u1" }, { user_id: "u2" }],
    });
    const { summary, memberships } = await listCanonicalMembershipsForAdmin(admin);
    expect(memberships).toHaveLength(2);
    expect(memberships[0]).toMatchObject({ organizationKey: "BTY_LEGACY", organizationName: "BTY Legacy Organization", jobFamilyKey: null, primaryRoleKey: null });
    expect(summary.reconciliationStatus).toBe("aligned");
    expect(summary).toMatchObject({ approvedRequests: 2, activeCanonicalMemberships: 2, approvedWithoutCanonical: 0, canonicalWithoutApproved: 0, unknownJobFamily: 2, unknownPrimaryRole: 2, fullyClassified: 0 });
    // NEVER queries legacy tables
    expect(touched.has("memberships")).toBe(false);
    expect(touched.has("organizations")).toBe(false);
  });

  it("orders unresolved identity first, then by created_at, then id", async () => {
    const { admin } = makeListAdmin({
      orgs: [ORG],
      memberships: [
        mem({ id: "resolved", user_id: "u1", job_family_key: "CLINICAL_PROVIDER", primary_role_key: "GENERAL_DENTIST", created_at: "2026-01-01T00:00:00Z" }),
        mem({ id: "unresolved-newer", user_id: "u2", created_at: "2026-03-01T00:00:00Z" }),
        mem({ id: "unresolved-older", user_id: "u3", created_at: "2026-02-01T00:00:00Z" }),
      ],
      approved: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }],
    });
    const { memberships, summary } = await listCanonicalMembershipsForAdmin(admin);
    expect(memberships.map((m) => m.membershipId)).toEqual(["unresolved-older", "unresolved-newer", "resolved"]);
    expect(summary.fullyClassified).toBe(1);
    expect(summary.unknownJobFamily).toBe(2);
  });

  it("flags drift: an approved user with no canonical membership", async () => {
    const { admin } = makeListAdmin({
      orgs: [ORG],
      memberships: [mem({ user_id: "u1" })],
      approved: [{ user_id: "u1" }, { user_id: "u2" }],
    });
    const { summary } = await listCanonicalMembershipsForAdmin(admin);
    expect(summary.reconciliationStatus).toBe("drift");
    expect(summary.approvedWithoutCanonical).toBe(1);
    expect(summary.canonicalWithoutApproved).toBe(0);
  });

  it("flags drift: an active canonical member with no approved access", async () => {
    const { admin } = makeListAdmin({
      orgs: [ORG],
      memberships: [mem({ user_id: "u1" }), mem({ id: "m2", user_id: "ghost" })],
      approved: [{ user_id: "u1" }],
    });
    const { summary } = await listCanonicalMembershipsForAdmin(admin);
    expect(summary.reconciliationStatus).toBe("drift");
    expect(summary.canonicalWithoutApproved).toBe(1);
  });

  it("flags drift: an unresolved organization reference", async () => {
    const { admin } = makeListAdmin({
      orgs: [], // org row missing
      memberships: [mem({ user_id: "u1", organization_id: "missing" })],
      approved: [{ user_id: "u1" }],
    });
    const { summary, memberships } = await listCanonicalMembershipsForAdmin(admin);
    expect(memberships[0].organizationKey).toBeNull();
    expect(summary.unresolvedOrganization).toBe(1);
    expect(summary.reconciliationStatus).toBe("drift");
  });
});
