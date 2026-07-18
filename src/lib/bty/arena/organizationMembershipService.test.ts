import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureCanonicalMembershipFromApproval,
  reconciliationStatus,
  validateProfessionalIdentity,
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
