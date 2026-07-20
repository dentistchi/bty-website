import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the Slice 3.1A-3 curation migration (post-correction). Asserts the
 * DDL DECLARES the invariants this slice requires — a canonical DATE role column, DURABLE
 * (non-cascading) append-only audit, DB-level (family, role) compatibility, a
 * membership-PRESERVING atomic RPC that never changes organization_id, and service-role-only
 * EXECUTE — so a future edit cannot silently drop them. Actual enforcement is verified against
 * Postgres at apply time (apply is gated).
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260719000000_bty_org_membership_identity_curation_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");

describe("bty org-membership curation migration (schema-intent)", () => {
  it("adds a canonical role_started_on DATE column (calendar date, no timezone)", () => {
    expect(SQL).toMatch(/alter table public\.bty_org_memberships add column if not exists role_started_on date/i);
    // the vestigial timestamptz column is NOT cast/used as the curated value
    expect(SQL).not.toMatch(/role_started_on timestamptz/i);
    expect(SQL).not.toMatch(/::timestamptz/i);
  });

  it("creates an append-only audit table with DATE role fields + is_primary snapshot", () => {
    expect(SQL).toMatch(/create table if not exists public\.bty_org_membership_identity_audit/i);
    // actor is recorded on every row; durability now lives in changed_by_snapshot
    expect(SQL).toMatch(/changed_by uuid null references auth\.users \(id\)/i);
    expect(SQL).toMatch(/changed_by_snapshot uuid not null/i);
    expect(SQL).toMatch(/changed_at timestamptz not null default now\(\)/i);
    expect(SQL).toMatch(/prev_role_started_on date/i);
    expect(SQL).toMatch(/new_role_started_on date/i);
    expect(SQL).toMatch(/prev_is_primary boolean/i);
    expect(SQL).toMatch(/new_is_primary boolean/i);
    // append-only: no UPDATE/DELETE of history in the migration
    expect(SQL).not.toMatch(/update public\.bty_org_membership_identity_audit/i);
  });

  it("makes audit history DURABLE WITHOUT blocking deletion — SET NULL FKs + NOT NULL snapshots", () => {
    // Live FKs are convenience joins: nullable, ON DELETE SET NULL. They must NOT be
    // RESTRICT, because auth.users deletion is an already-shipped contract
    // (bty_org_memberships.user_id is ON DELETE CASCADE; /api/admin/users DELETE and the
    // e2e fixture services all delete users). RESTRICT would break those live paths.
    expect(SQL).toMatch(/membership_id uuid null references public\.bty_org_memberships \(id\) on delete set null/i);
    expect(SQL).toMatch(/user_id uuid null references auth\.users \(id\) on delete set null/i);
    expect(SQL).toMatch(/changed_by uuid null references auth\.users \(id\) on delete set null/i);

    // Durability lives in FK-free, NOT NULL uuid snapshots — nothing can null or remove them.
    expect(SQL).toMatch(/membership_id_snapshot uuid not null/i);
    expect(SQL).toMatch(/user_id_snapshot uuid not null/i);
    expect(SQL).toMatch(/changed_by_snapshot uuid not null/i);
    // snapshots must carry NO foreign key (that is the whole point)
    expect(SQL).not.toMatch(/_snapshot uuid not null references/i);

    const auditBlock = RAW.slice(
      RAW.indexOf("create table if not exists public.bty_org_membership_identity_audit"),
      RAW.indexOf("bty_org_membership_identity_audit_membership_idx"),
    );
    // deleting a user must never ERASE history
    expect(auditBlock).not.toMatch(/on delete cascade/i);
    expect(auditBlock).not.toMatch(/on delete restrict/i);
  });

  it("indexes audit history on the never-nulled snapshot so it stays queryable post-deletion", () => {
    expect(SQL).toMatch(
      /create index if not exists bty_org_membership_identity_audit_membership_idx on public\.bty_org_membership_identity_audit \(membership_id_snapshot, changed_at desc\)/i,
    );
  });

  it("writes both the live FK and the immutable snapshot on every audit row", () => {
    expect(SQL).toMatch(
      /membership_id, user_id, changed_by, membership_id_snapshot, user_id_snapshot, changed_by_snapshot,/i,
    );
    expect(SQL).toMatch(/v_id, p_user_id, p_changed_by, v_id, p_user_id, p_changed_by,/i);
  });

  it("makes the audit table client-deny (RLS + revoke)", () => {
    expect(SQL).toMatch(/revoke all on public\.bty_org_membership_identity_audit from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.bty_org_membership_identity_audit enable row level security/i);
  });

  it("enforces (family, role) compatibility at the DB level (injection defence)", () => {
    expect(SQL).toMatch(/add constraint bty_org_membership_family_role_compat check/i);
    expect(SQL).toMatch(/\('GENERAL_DENTIST', 'CLINICAL_PROVIDER'\)/i);
    expect(SQL).toMatch(/\('SSO_HR', 'SHARED_SERVICES'\)/i);
    expect(SQL).toMatch(/if not exists \(\s*select 1 from pg_constraint where conname = 'bty_org_membership_family_role_compat'/i);
  });

  it("defines a membership-PRESERVING atomic RPC that never changes organization_id", () => {
    expect(SQL).toMatch(/create or replace function public\.bty_curate_membership_identity\(\s*p_user_id uuid,\s*p_organization_id uuid/i);
    expect(SQL).toMatch(/security definer/i);
    expect(SQL).toMatch(/for update/i); // row lock
    // resolves an EXISTING membership by (user, org); never inserts/deletes/repoints
    expect(SQL).toMatch(/where m\.user_id = p_user_id\s+and m\.organization_id = p_organization_id/i);
    expect(SQL).not.toMatch(/insert into public\.bty_org_memberships/i);
    expect(SQL).not.toMatch(/delete from public\.bty_org_memberships/i);
    // the two UPDATEs must NEVER set organization_id
    expect(SQL).not.toMatch(/set[^;]*organization_id\s*=/i);
    // primary (re)designation: demote others is_primary=false, promote target is_primary=true
    expect(SQL).toMatch(/is_primary = false/i);
    expect(SQL).toMatch(/is_primary = true/i);
    expect(SQL).toMatch(/identity_source = 'admin_curated'/i);
    expect(SQL).toMatch(/insert into public\.bty_org_membership_identity_audit/i);
    // the demote is SCOPED to the user's OTHER active primary — an unrelated (non-primary,
    // inactive, or different-user) membership is never touched → stays byte-equivalent.
    expect(SQL).toMatch(/set is_primary = false,\s*updated_at = now\(\) where user_id = p_user_id and status = 'active' and is_primary = true and id <> v_id/i);
  });

  it("rejects curation when the user has no membership in the selected org", () => {
    expect(SQL).toMatch(/organization_membership_missing/i);
    expect(SQL).toMatch(/role_date_future/i);
    expect(SQL).toMatch(/p_role_started_on > current_date/i);
  });

  it("requires the target membership to be ACTIVE, and judges status AFTER locking it", () => {
    // status must be selected (so it can be judged) and NOT filtered in the WHERE — the
    // lookup has to distinguish "missing" from "inactive".
    expect(SQL).toMatch(/select m\.id, m\.organization_id, m\.status,/i);
    expect(SQL).toMatch(/into v_id, v_org, v_status,/i);
    expect(SQL).not.toMatch(/where m\.user_id = p_user_id and m\.organization_id = p_organization_id and m\.status/i);
    // explicit post-lock status gate with its own stable error
    expect(SQL).toMatch(
      /if v_status is distinct from 'active' then raise exception 'organization_membership_inactive'/i,
    );
  });

  it("rejects an inactive target BEFORE any write — no demotion, no audit row", () => {
    const body = RAW.slice(RAW.indexOf("begin"), RAW.indexOf("-- CONFLICT AWARENESS"));
    const inactiveGuard = body.indexOf("organization_membership_inactive");
    expect(inactiveGuard).toBeGreaterThan(-1);
    // every mutating statement must appear AFTER the guard raises
    expect(body.indexOf("update public.bty_org_memberships")).toBeGreaterThan(inactiveGuard);
    expect(body.indexOf("insert into public.bty_org_membership_identity_audit")).toBeGreaterThan(inactiveGuard);
  });

  it("is conflict-aware: translates the one-active-primary unique violation into a stable reason", () => {
    expect(SQL).toMatch(/exception when unique_violation then/i);
    expect(SQL).toMatch(/get stacked diagnostics v_constraint = constraint_name/i);
    expect(SQL).toMatch(/if v_constraint = 'bty_org_membership_one_active_primary' then/i);
    expect(SQL).toMatch(/raise exception 'primary_membership_conflict'/i);
    // an unrelated unique violation is re-raised, never swallowed
    expect(SQL).toMatch(/end if; raise; end;/i);
  });

  it("hardens the SECURITY DEFINER search_path (pg_catalog pinned first)", () => {
    expect(SQL).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/i);
    expect(SQL).not.toMatch(/set search_path = public\b/i);
  });

  it("is service-role only: EXECUTE revoked from public/anon/authenticated AND granted to service_role", () => {
    expect(SQL).toMatch(
      /revoke execute on function public\.bty_curate_membership_identity\(uuid, uuid, text, text, date, uuid\) from public, anon, authenticated/i,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.bty_curate_membership_identity\(uuid, uuid, text, text, date, uuid\) to service_role/i,
    );
  });

  it("does not touch XP / the legacy memberships table", () => {
    expect(SQL).not.toMatch(/\b(total_xp|weekly_xp|core_xp)\b/i);
    expect(SQL).not.toMatch(/\bpublic\.memberships\b/i);
    expect(SQL).not.toMatch(/into public\.arena_membership_requests/i);
    expect(SQL).not.toMatch(/update public\.arena_membership_requests/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});

/**
 * The single-active-primary invariant is owned by the 3.1A-1 FOUNDATION migration, not by
 * this slice — so this slice adds NO new index. Asserted here because the curation RPC's
 * concurrency correctness depends on it: it is the INDEX, not the `for update` row lock,
 * that serializes two concurrent curations for the same user targeting DIFFERENT
 * organizations (those lock disjoint rows and never contend).
 */
describe("single-active-primary DB invariant (foundation migration)", () => {
  const FOUNDATION = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20260718000000_bty_org_membership_foundation_v1.sql"),
    "utf8",
  ).replace(/\s+/g, " ");

  it("declares a partial unique index: at most one active primary membership per user", () => {
    expect(FOUNDATION).toMatch(
      /create unique index if not exists bty_org_membership_one_active_primary on public\.bty_org_memberships \(user_id\) where \(status = 'active' and is_primary = true\)/i,
    );
  });

  it("keys the invariant on user_id ALONE, so it spans every organization", () => {
    // Keying on (user_id, organization_id) would permit one primary PER ORG — precisely the
    // two-active-primary state the concurrency requirement must rule out.
    expect(FOUNDATION).not.toMatch(/bty_org_membership_one_active_primary on public\.bty_org_memberships \(user_id, organization_id\)/i);
  });

  it("leaves INACTIVE memberships unconstrained (partial predicate on status)", () => {
    expect(FOUNDATION).toMatch(/where \(status = 'active' and is_primary = true\)/i);
  });

  it("is idempotent / safely repeatable", () => {
    expect(FOUNDATION).toMatch(/create unique index if not exists bty_org_membership_one_active_primary/i);
  });

  it("the curation slice adds NO competing primary index of its own", () => {
    expect(SQL).not.toMatch(/create unique index[\s\S]*is_primary/i);
  });
});
