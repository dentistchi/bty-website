import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the Slice 3.1B-1 responsibilities migration. Asserts the DDL
 * DECLARES the invariants this slice requires — membership-scoped 0..n rows, a closed
 * vocabulary, duplicate-proof active assignment, honest (non-destructive) removal, durable
 * history, service-role-only EXECUTE, and ZERO coupling to access/XP/legacy leader signals
 * — so a future edit cannot silently drop them.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260720000000_bty_org_membership_responsibilities_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
/**
 * Executable DDL only — `--` comments stripped. The header deliberately NAMES the legacy
 * leader signals in order to document that they are excluded, so "this migration must not
 * reference X" has to be asserted against code, not prose.
 */
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("bty org-membership responsibilities migration (schema-intent)", () => {
  it("creates a MEMBERSHIP-scoped table (not user-scoped)", () => {
    expect(SQL).toMatch(/create table if not exists public\.bty_org_membership_responsibilities/i);
    expect(SQL).toMatch(/membership_id uuid not null references public\.bty_org_memberships \(id\)/i);
    // responsibilities belong to the membership, never globally to the user
    expect(SQL).not.toMatch(/create table if not exists public\.bty_org_membership_responsibilities \([^)]*user_id uuid not null/i);
  });

  it("closes the vocabulary to the five canonical keys via a CHECK", () => {
    expect(SQL).toMatch(
      /responsibility_key in \( 'PARTNER', 'CLINICAL_DIRECTOR', 'TRAINER', 'TEAM_LEAD', 'PEOPLE_MANAGER' \)/i,
    );
  });

  it("uses TEAM_LEAD, never the bare LEAD key that would collide with office_assignments.is_lead", () => {
    expect(CODE).toMatch(/'TEAM_LEAD'/);
    expect(CODE).not.toMatch(/'LEAD'/);
    // and never reads or writes the legacy authorization flag
    expect(CODE).not.toMatch(/is_lead/i);
  });

  it("makes a duplicate ACTIVE assignment impossible at the DB level", () => {
    expect(SQL).toMatch(
      /create unique index if not exists bty_org_membership_responsibility_one_active on public\.bty_org_membership_responsibilities \(membership_id, responsibility_key\) where \(status = 'active'\)/i,
    );
  });

  it("keeps start date nullable (unknown stays unknown) and typed DATE (no timezone)", () => {
    expect(SQL).toMatch(/started_on date null/i);
    expect(SQL).not.toMatch(/started_on timestamptz/i);
    expect(SQL).not.toMatch(/::timestamptz/i);
  });

  it("records removal HONESTLY — status flip, never a hard delete of state or history", () => {
    expect(SQL).toMatch(/status text not null default 'active'/i);
    expect(SQL).toMatch(/check \(status in \('active', 'removed'\)\)/i);
    expect(SQL).toMatch(/set status = 'removed'/i);
    expect(SQL).not.toMatch(/delete from public\.bty_org_membership_responsibilities/i);
    expect(SQL).not.toMatch(/delete from public\.bty_org_membership_responsibility_audit/i);
    expect(SQL).not.toMatch(/update public\.bty_org_membership_responsibility_audit/i);
  });

  it("gives history the 3.1A-3 durability contract — SET NULL FKs + NOT NULL snapshots", () => {
    expect(SQL).toMatch(/responsibility_id uuid null references public\.bty_org_membership_responsibilities \(id\) on delete set null/i);
    expect(SQL).toMatch(/membership_id uuid null references public\.bty_org_memberships \(id\) on delete set null/i);
    expect(SQL).toMatch(/changed_by uuid null references auth\.users \(id\) on delete set null/i);
    expect(SQL).toMatch(/responsibility_id_snapshot uuid not null/i);
    expect(SQL).toMatch(/membership_id_snapshot uuid not null/i);
    expect(SQL).toMatch(/changed_by_snapshot uuid not null/i);
    const auditBlock = RAW.slice(
      RAW.indexOf("create table if not exists public.bty_org_membership_responsibility_audit"),
      RAW.indexOf("bty_org_membership_responsibility_audit_membership_idx"),
    );
    expect(auditBlock).not.toMatch(/on delete restrict/i);
    expect(auditBlock).not.toMatch(/on delete cascade/i);
  });

  it("makes both tables client-deny (RLS + revoke)", () => {
    for (const t of [
      "bty_org_membership_responsibilities",
      "bty_org_membership_responsibility_audit",
    ]) {
      expect(SQL).toMatch(new RegExp(`revoke all on public\\.${t} from anon, public, authenticated`, "i"));
      expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
  });

  it("requires an ACTIVE membership and rejects a future date before any write", () => {
    expect(SQL).toMatch(/organization_membership_missing/i);
    expect(SQL).toMatch(/if v_membership_status is distinct from 'active' then raise exception 'organization_membership_inactive'/i);
    expect(SQL).toMatch(/p_started_on > current_date/i);
    expect(SQL).toMatch(/responsibility_date_future/i);
    // guards precede every mutation
    const body = RAW.slice(RAW.indexOf("begin"), RAW.indexOf("-- Conflict awareness"));
    const guard = body.indexOf("responsibility_date_future");
    expect(body.indexOf("insert into public.bty_org_membership_responsibilities")).toBeGreaterThan(guard);
    expect(body.indexOf("insert into public.bty_org_membership_responsibility_audit")).toBeGreaterThan(guard);
  });

  it("rejects duplicate assign and is conflict-aware on the partial unique index", () => {
    expect(SQL).toMatch(/raise exception 'responsibility_already_active'/i);
    expect(SQL).toMatch(/raise exception 'responsibility_not_active'/i);
    expect(SQL).toMatch(/exception when unique_violation then/i);
    expect(SQL).toMatch(/get stacked diagnostics v_constraint = constraint_name/i);
    expect(SQL).toMatch(/if v_constraint = 'bty_org_membership_responsibility_one_active' then/i);
    expect(SQL).toMatch(/end if; raise; end;/i);
  });

  it("hardens SECURITY DEFINER search_path and is service-role only", () => {
    expect(SQL).toMatch(/security definer set search_path = pg_catalog, public/i);
    expect(SQL).toMatch(
      /revoke execute on function public\.bty_curate_membership_responsibility\(uuid, text, text, date, uuid\) from public, anon, authenticated/i,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.bty_curate_membership_responsibility\(uuid, text, text, date, uuid\) to service_role/i,
    );
  });

  it("NEVER touches primary role, job family, or any identity column on the membership", () => {
    expect(SQL).not.toMatch(/update public\.bty_org_memberships/i);
    expect(SQL).not.toMatch(/set[^;]*primary_role_key\s*=/i);
    expect(SQL).not.toMatch(/set[^;]*job_family_key\s*=/i);
    expect(SQL).not.toMatch(/set[^;]*is_primary\s*=/i);
  });

  it("grants no access and touches no XP / Arena / Foundry / Learning Path surface", () => {
    expect(CODE).not.toMatch(/\b(total_xp|weekly_xp|core_xp|lifetime_xp)\b/i);
    expect(CODE).not.toMatch(/\barena_membership_requests\b/i);
    expect(CODE).not.toMatch(/\bfoundry_/i);
    expect(CODE).not.toMatch(/\blearning_path/i);
    expect(CODE).not.toMatch(/\bleaderboard/i);
    expect(CODE).not.toMatch(/\bpublic\.memberships\b/i);
  });

  it("never migrates or infers from any legacy leader signal", () => {
    for (const legacy of [
      "leader_started_at",
      "is_leader_track",
      "job_function",
      "certified_leader_grants",
      "leadership_engine_state",
    ]) {
      expect(CODE).not.toMatch(new RegExp(`\\b${legacy}\\b`, "i"));
    }
    // nothing is back-filled: no INSERT ... SELECT seeding of responsibilities
    expect(CODE).not.toMatch(/insert into public\.bty_org_membership_responsibilities[^;]*select/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});
