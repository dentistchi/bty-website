import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the Slice 3.1B-3N Action Review Authority migration. Asserts the
 * DDL DECLARES the invariants this slice requires — an explicit reviewer->learner edge,
 * ACTION_REVIEWER-only vocabulary, ON DELETE RESTRICT (never CASCADE) on membership FKs,
 * one-active-edge uniqueness, effective/revoked-state consistency, a DB validation trigger
 * (cross-org / self / unbound / inactive defense), append-only immutable audit (DB-enforced
 * UPDATE/DELETE rejection), service_role SELECT-only table privileges, service-role-only RPC
 * EXECUTE, partial-state-safe rollback covering every object, and ZERO escalation coupling —
 * so a future edit cannot silently drop them.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260730000000_bty_org_action_review_authority_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
// Executable DDL only — line comments stripped (headers name deferred concepts on purpose).
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("bty org action-review-authority migration (schema-intent)", () => {
  it("wraps all executable DDL in a single transaction (begin; ... commit;)", () => {
    expect(CODE.trimStart()).toMatch(/^begin;/i);
    expect(CODE.trimEnd()).toMatch(/commit;$/i);
    // exactly one begin and one commit
    expect((CODE.match(/\bbegin;/gi) ?? []).length).toBe(1);
    expect((CODE.match(/\bcommit;/gi) ?? []).length).toBe(1);
  });

  it("audit convenience FKs removed: authority_id / changed_by are plain nullable UUIDs (no REFERENCES)", () => {
    expect(SQL).toMatch(/authority_id uuid null, changed_by uuid null,/i);
    expect(SQL).not.toMatch(/authority_id uuid null\s*references/i);
    expect(SQL).not.toMatch(/changed_by uuid null\s*references/i);
    // and NOT re-added as RESTRICT (would block identity/state cleanup)
    expect(CODE).not.toMatch(/authority_id uuid null[^,]*on delete restrict/i);
  });

  it("creates the state table as a reviewer->learner MEMBERSHIP edge", () => {
    expect(SQL).toMatch(/create table if not exists public\.bty_org_action_review_authority/i);
    expect(SQL).toMatch(/reviewer_membership_id uuid not null references public\.bty_org_memberships \(id\)/i);
    expect(SQL).toMatch(/learner_membership_id uuid not null references public\.bty_org_memberships \(id\)/i);
    expect(SQL).toMatch(/organization_id uuid not null references public\.bty_organizations \(id\)/i);
  });

  it("uses ON DELETE RESTRICT for membership + organization FKs (never CASCADE)", () => {
    const restrictRefs = CODE.match(/references public\.bty_org_memberships \(id\) on delete restrict/gi) ?? [];
    expect(restrictRefs.length).toBe(2);
    expect(CODE).toMatch(/references public\.bty_organizations \(id\) on delete restrict/i);
    expect(CODE).not.toMatch(/references public\.bty_org_memberships \(id\) on delete cascade/i);
  });

  it("closes authority_key to ACTION_REVIEWER only", () => {
    expect(SQL).toMatch(/authority_key in \('ACTION_REVIEWER'\)/i);
    expect(CODE).not.toMatch(/'PEOPLE_MANAGER'|'PARTNER'|'CLINICAL_DIRECTOR'|'TRAINER'|'TEAM_LEAD'/);
  });

  it("enforces non-self, status vocabulary, and effective/revoked consistency via CHECK", () => {
    expect(SQL).toMatch(/check \(reviewer_membership_id <> learner_membership_id\)/i);
    expect(SQL).toMatch(/status in \('active', 'revoked'\)/i);
    expect(SQL).toMatch(/status = 'active' and revoked_at is null/i);
    expect(SQL).toMatch(/status = 'revoked' and revoked_at is not null/i);
    expect(SQL).toMatch(/started_on date not null default current_date/i);
  });

  it("guarantees one ACTIVE edge per (reviewer, learner, authority) via a partial unique index", () => {
    expect(SQL).toMatch(
      /create unique index if not exists bty_action_review_authority_one_active on public\.bty_org_action_review_authority \(reviewer_membership_id, learner_membership_id, authority_key\) where \(status = 'active'\)/i,
    );
  });

  it("installs a BEFORE INSERT OR UPDATE state validation trigger with all reject reasons", () => {
    expect(SQL).toMatch(/create or replace trigger bty_action_review_authority_validate_trg before insert or update on public\.bty_org_action_review_authority/i);
    for (const reason of [
      "reviewer_membership_missing",
      "learner_membership_missing",
      "reviewer_membership_inactive",
      "learner_membership_inactive",
      "reviewer_membership_unbound",
      "learner_membership_unbound",
      "action_review_cross_org",
      "action_review_self",
      "invalid_action_review_authority",
      "action_review_future_start",
    ]) {
      expect(CODE).toContain(reason);
    }
    // org integrity enforced at the DB layer, NOT by altering bty_org_memberships
    expect(CODE).not.toMatch(/alter table public\.bty_org_memberships/i);
  });

  it("full membership validation applies ONLY to ACTIVE edges (a revoke is never blocked)", () => {
    // the validate fn gates the membership/org checks behind `if new.status = 'active'`
    expect(CODE).toMatch(/if new\.status = 'active' then[\s\S]*reviewer_membership_missing/);
  });

  it("makes the audit table APPEND-ONLY at the DB layer (UPDATE/DELETE rejected)", () => {
    expect(SQL).toMatch(/create or replace function public\.bty_action_review_authority_audit_immutable\(\)/i);
    expect(CODE).toContain("action_review_authority_audit_immutable");
    expect(SQL).toMatch(
      /create or replace trigger bty_action_review_authority_audit_immutable_trg before update or delete on public\.bty_org_action_review_authority_audit/i,
    );
    // audit table must be created BEFORE its trigger (root cause of the 42P01)
    expect(SQL.indexOf("create table if not exists public.bty_org_action_review_authority_audit"))
      .toBeLessThan(SQL.indexOf("create or replace trigger bty_action_review_authority_audit_immutable_trg"));
    // immutability must not block INSERT (the trusted RPC appends)
    expect(CODE).not.toMatch(/before insert or (update|delete)[^;]*on public\.bty_org_action_review_authority_audit/i);
  });

  it("gives service_role SELECT-only on both tables (no direct INSERT/UPDATE/DELETE/TRUNCATE)", () => {
    expect(CODE).toMatch(/revoke all on public\.bty_org_action_review_authority from service_role/i);
    expect(CODE).toMatch(/revoke all on public\.bty_org_action_review_authority_audit from service_role/i);
    expect(CODE).toMatch(/grant select on public\.bty_org_action_review_authority to service_role/i);
    expect(CODE).toMatch(/grant select on public\.bty_org_action_review_authority_audit to service_role/i);
    // never a direct mutation grant to service_role
    expect(CODE).not.toMatch(/grant (insert|update|delete|truncate|all)[^;]*to service_role/i);
  });

  it("curation RPC is service-role-only, actor-validated, supports assign + revoke", () => {
    expect(SQL).toMatch(/create or replace function public\.bty_curate_action_review_authority/i);
    expect(SQL).toMatch(/security definer set search_path = pg_catalog, public/i);
    expect(CODE).toContain("action_review_actor_missing");
    expect(CODE).toContain("action_review_actor_invalid");
    expect(CODE).toContain("from auth.users u where u.id = p_changed_by");
    expect(SQL).toMatch(
      /grant execute on function public\.bty_curate_action_review_authority\(uuid, uuid, text, text, date, uuid\) to service_role/i,
    );
    expect(SQL).toMatch(
      /revoke execute on function public\.bty_curate_action_review_authority\(uuid, uuid, text, text, date, uuid\) from public, anon, authenticated/i,
    );
  });

  it("RPC v4 lifecycle: NULL action rejected explicitly; assign validates; revoke is teardown-safe", () => {
    const rpcStart = CODE.indexOf("create or replace function public.bty_curate_action_review_authority");
    const rpcCode = CODE.slice(rpcStart, CODE.indexOf("grant execute on function public.bty_curate_action_review_authority", rpcStart));

    // (1)(2) NULL-safe action check, placed BEFORE the assign/revoke branch (so null can't reach revoke)
    expect(rpcCode).toMatch(/if p_action is null or p_action not in \('assign', 'revoke'\) then/i);
    expect(rpcCode.indexOf("p_action is null or p_action not in")).toBeLessThan(rpcCode.indexOf("if p_action = 'assign' then"));

    // (3) assign path still requires active + bound memberships
    expect(rpcCode).toMatch(/if p_action = 'assign' then[\s\S]*reviewer_membership_inactive[\s\S]*reviewer_membership_unbound[\s\S]*learner_membership_inactive[\s\S]*learner_membership_unbound/i);

    // (4) revoke selects an existing ACTIVE edge FOR UPDATE, then errors action_review_not_active if absent
    const revokeCode = rpcCode.slice(rpcCode.indexOf("action_review_not_active"));
    // (5)(6) revoke path does NOT re-validate membership status/binding
    expect(revokeCode).not.toMatch(/reviewer_membership_inactive|learner_membership_inactive|reviewer_membership_unbound|learner_membership_unbound/i);
    // (7) revoke uses organization_id from the stored authority row
    expect(revokeCode).toMatch(/v_org := v_row\.organization_id/i);
    // (9) repeated revoke raises BEFORE the audit insert (no false success audit)
    expect(rpcCode.indexOf("action_review_not_active"))
      .toBeLessThan(rpcCode.indexOf("insert into public.bty_org_action_review_authority_audit"));

    // membership status checks live ONLY in the assign path within the RPC (once each)
    expect((rpcCode.match(/reviewer_membership_inactive/gi) ?? []).length).toBe(1);
    expect((rpcCode.match(/learner_membership_inactive/gi) ?? []).length).toBe(1);
  });

  it("append-only audit keeps immutable FK-free snapshots for both memberships + org + actor", () => {
    expect(SQL).toMatch(/create table if not exists public\.bty_org_action_review_authority_audit/i);
    for (const col of [
      "authority_id_snapshot uuid not null",
      "reviewer_membership_id_snapshot uuid not null",
      "learner_membership_id_snapshot uuid not null",
      "organization_id_snapshot uuid not null",
      "changed_by_snapshot uuid not null",
    ]) {
      expect(SQL).toMatch(new RegExp(col, "i"));
    }
    expect(SQL).toMatch(/action in \('assign', 'revoke'\)/i);
  });

  it("locks tables from client roles (RLS on, no permissive policy, no client grants)", () => {
    expect(CODE).toMatch(/revoke all on public\.bty_org_action_review_authority from anon, public, authenticated/i);
    expect(CODE).toMatch(/alter table public\.bty_org_action_review_authority enable row level security/i);
    expect(CODE).toMatch(/alter table public\.bty_org_action_review_authority_audit enable row level security/i);
    expect(CODE).not.toMatch(/create policy/i);
    expect(CODE).not.toMatch(/grant (select|insert|update|delete)[^;]*to (anon|authenticated|public)/i);
  });

  it("does NOT touch escalation reviewer columns (deferred to Slice 3.1B-3O)", () => {
    expect(CODE).not.toMatch(/bty_action_contract_escalations/i);
    expect(CODE).not.toMatch(/bty_action_contract_escalation_resolutions/i);
    expect(CODE).not.toMatch(/reviewer_notes|resolved_at|resolution/i);
  });

  it("is additive + idempotent and touches no existing table", () => {
    expect(CODE).not.toMatch(/alter table public\.bty_action_contracts/i);
    expect(CODE).toMatch(/create table if not exists/i);
    expect(CODE).toMatch(/create unique index if not exists/i);
  });

  it("rollback block is partial-state-safe (no CASCADE) and covers every created object", () => {
    // the rollback lives in the trailing comment block; assert against RAW
    for (const obj of [
      "bty_curate_action_review_authority(uuid, uuid, text, text, date, uuid)",
      "bty_action_review_authority_audit_immutable_trg",
      "bty_action_review_authority_audit_immutable()",
      "bty_action_review_authority_validate_trg",
      "bty_action_review_authority_validate()",
      "bty_org_action_review_authority_audit",
      "bty_org_action_review_authority",
    ]) {
      expect(RAW).toContain(`drop`);
      expect(RAW.toLowerCase()).toContain(obj.toLowerCase());
    }
    expect(RAW).toMatch(/to_regclass\('public\.bty_org_action_review_authority_audit'\) is not null/i);
    expect(RAW).toMatch(/to_regclass\('public\.bty_org_action_review_authority'\) is not null/i);
    // no CASCADE in EXECUTABLE DDL (comments/prose may mention the word)
    expect(CODE).not.toMatch(/cascade/i);
  });
});
