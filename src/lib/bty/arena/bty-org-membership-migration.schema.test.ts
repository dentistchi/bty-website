import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the Slice 3.1A-1 canonical membership foundation migration.
 * Asserts the DDL DECLARES the invariants the slice requires so a future edit cannot
 * silently drop them. Actual enforcement is verified against Postgres at apply time
 * (this slice is HELD before apply).
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260718000000_bty_org_membership_foundation_v1.sql"),
  "utf8",
).replace(/\s+/g, " ");

describe("bty org-membership foundation migration (schema-intent)", () => {
  it("creates the three namespaced tables idempotently (never plain `organizations`)", () => {
    expect(SQL).toMatch(/create table if not exists public\.bty_enterprises/i);
    expect(SQL).toMatch(/create table if not exists public\.bty_organizations/i);
    expect(SQL).toMatch(/create table if not exists public\.bty_org_memberships/i);
    // must NOT create/alter the occupied legacy `organizations` table
    expect(SQL).not.toMatch(/create table if not exists public\.organizations\b/i);
    expect(SQL).not.toMatch(/alter table public\.organizations\b/i);
  });

  it("wires the enterprise → organization → membership lineage with real FKs", () => {
    expect(SQL).toMatch(/enterprise_id uuid not null references public\.bty_enterprises \(id\)/i);
    expect(SQL).toMatch(/user_id uuid not null references auth\.users \(id\) on delete cascade/i);
    expect(SQL).toMatch(/organization_id uuid not null references public\.bty_organizations \(id\)/i);
    // measurement-driven: request PK is bigserial → bigint FK
    expect(SQL).toMatch(/source_membership_request_id bigint null references public\.arena_membership_requests \(id\) on delete set null/i);
  });

  it("uses stable-key CHECK taxonomy with NULL = unknown (no UNKNOWN key)", () => {
    expect(SQL).toMatch(/job_family_key text null/i);
    expect(SQL).toMatch(/primary_role_key text null/i);
    expect(SQL).toMatch(/job_family_key is null or job_family_key in \(\s*'CLINICAL_PROVIDER'/i);
    expect(SQL).toMatch(/primary_role_key is null or primary_role_key in \(\s*'GENERAL_DENTIST'/i);
    expect(SQL).not.toMatch(/'UNKNOWN'/);
    // authority roles must NOT be primary roles
    expect(SQL).not.toMatch(/'PARTNER'|'CLINICAL_DIRECTOR'|'TRAINER'|'LEAD'/);
  });

  it("bounds identity_source + status and enforces one-per-(user,org)", () => {
    expect(SQL).toMatch(/identity_source in \('legacy_approved_request', 'membership_approval', 'admin_curated'\)/i);
    expect(SQL).toMatch(/status in \('active', 'inactive'\)/i);
    expect(SQL).toMatch(/unique \(user_id, organization_id\)/i);
  });

  it("enforces at most one ACTIVE PRIMARY membership per user (partial unique index)", () => {
    expect(SQL).toMatch(/create unique index if not exists bty_org_membership_one_active_primary on public\.bty_org_memberships \(user_id\) where \(status = 'active' and is_primary = true\)/i);
  });

  it("is client-deny (RLS on + revoke) for all three tables", () => {
    for (const t of ["bty_enterprises", "bty_organizations", "bty_org_memberships"]) {
      expect(SQL).toMatch(new RegExp(`revoke all on public\\.${t} from anon, public, authenticated`, "i"));
      expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
  });

  it("seeds BTY_DSO + BTY_LEGACY idempotently", () => {
    expect(SQL).toMatch(/insert into public\.bty_enterprises \(enterprise_key, display_name, status\) values \('BTY_DSO', 'BTY DSO', 'active'\) on conflict \(enterprise_key\) do nothing/i);
    expect(SQL).toMatch(/'BTY_LEGACY', 'BTY Legacy Organization', 'active'/i);
    expect(SQL).toMatch(/on conflict \(enterprise_id, organization_key\) do nothing/i);
  });

  it("backfills approved members with UNKNOWN identity, idempotently and curation-safe", () => {
    expect(SQL).toMatch(/insert into public\.bty_org_memberships/i);
    expect(SQL).toMatch(/from public\.arena_membership_requests r/i);
    expect(SQL).toMatch(/where r\.status = 'approved'/i);
    expect(SQL).toMatch(/'legacy_approved_request'/i);
    // never guess: backfill sets only user/org/status/primary/joined_at/source — no role/family
    expect(SQL).toMatch(/on conflict \(user_id, organization_id\) do nothing/i);
    // never create a second active primary (protects curated rows)
    expect(SQL).toMatch(/not exists \(\s*select 1 from public\.bty_org_memberships m where m\.user_id = r\.user_id and m\.status = 'active' and m\.is_primary = true\s*\)/i);
  });

  it("NEVER touches the legacy `memberships` table or introduces XP columns", () => {
    expect(SQL).not.toMatch(/\bpublic\.memberships\b/i);
    expect(SQL).not.toMatch(/into memberships\b/i);
    expect(SQL).not.toMatch(/update memberships\b/i);
    expect(SQL).not.toMatch(/\b(total_xp|weekly_xp|core_xp)\b/i);
  });
});
