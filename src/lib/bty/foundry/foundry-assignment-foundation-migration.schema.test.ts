import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for Slice 3.1B-3B (identity-bound participation foundation).
 * MIGRATION-ONLY: asserts the DDL declares the participation-mode overlay, the immutable
 * audience snapshot, the assignment recipient set with its duplicate/claim constraints, the
 * append-only audit, and a service-role-only secure-boundary RPC — AND that it wires none of
 * this to product behavior, backfills nothing, and touches no existing Foundry/XP surface.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260721000000_foundry_assignment_foundation_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
const SQL = RAW.replace(/\s+/g, " ");
// Executable DDL only — comments deliberately name excluded/adjacent surfaces.
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("foundry assignment foundation migration (schema-intent)", () => {
  it("participation mode: absence means OPEN_LINK (no column on foundry_events, no backfill)", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_event_participation_mode/i);
    expect(SQL).toMatch(/event_id uuid primary key references public\.foundry_events \(id\) on delete cascade/i);
    expect(SQL).toMatch(/check \(mode in \('open_link', 'assigned_overlay'\)\)/i);
    // never alters foundry_events itself → existing events keep working untouched
    expect(CODE).not.toMatch(/alter table public\.foundry_events/i);
    // no backfill: no INSERT ... SELECT seeding modes/assignments from existing rows
    expect(CODE).not.toMatch(/insert into public\.foundry_event_participation_mode/i);
    expect(CODE).not.toMatch(/insert into public\.foundry_event_assignments[^;]*select/i);
  });

  it("audience snapshot: immutable declaration with org + resolver version + count", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_event_audience_snapshot/i);
    expect(SQL).toMatch(/organization_id uuid not null references public\.bty_organizations \(id\)/i);
    expect(SQL).toMatch(/audience_type text not null/i);
    expect(SQL).toMatch(/resolver_version text not null/i);
    expect(SQL).toMatch(/resolved_count integer not null/i);
    expect(SQL).toMatch(/check \(audience_type in \('everyone', 'leaders', 'job_group', 'specific_role'\)\)/i);
  });

  it("assignments: membership-scoped recipient set with duplicate prevention on the snapshot", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_event_assignments/i);
    expect(SQL).toMatch(/membership_id_snapshot uuid not null/i);
    expect(SQL).toMatch(/user_id_snapshot uuid not null/i);
    // one assignment per (event, membership), keyed on the immutable snapshot
    expect(SQL).toMatch(/unique \(event_id, membership_id_snapshot\)/i);
    // one participant claims at most one assignment per event
    expect(SQL).toMatch(
      /create unique index if not exists foundry_event_assignment_one_claim_per_participant on public\.foundry_event_assignments \(event_id, participant_id\) where \(participant_id is not null\)/i,
    );
  });

  it("assignment status vocabulary is minimal and honest (no scoring / behavior labels)", () => {
    expect(SQL).toMatch(/check \(status in \('assigned', 'claimed', 'completed', 'revoked'\)\)/i);
    for (const banned of ["failed", "noncompliant", "overdue", "missed", "behavior", "score", "verified"]) {
      expect(CODE).not.toMatch(new RegExp(`'${banned}'`, "i"));
    }
    // no due-date field — not required by the measured product
    expect(CODE).not.toMatch(/due_at/i);
  });

  it("claim + completion linkage is nullable (filled by later slices, not now)", () => {
    expect(SQL).toMatch(/participant_id uuid null references public\.foundry_event_participants \(id\) on delete set null/i);
    expect(SQL).toMatch(/claimed_at timestamptz null/i);
    expect(SQL).toMatch(/completed_at timestamptz null/i);
    expect(SQL).toMatch(/revoked_at timestamptz null/i);
  });

  it("durability: live FKs SET NULL + NOT NULL snapshots, never CASCADE/RESTRICT on identity", () => {
    expect(SQL).toMatch(/membership_id uuid null references public\.bty_org_memberships \(id\) on delete set null/i);
    expect(SQL).toMatch(/user_id uuid null references auth\.users \(id\) on delete set null/i);
    const assignBlock = RAW.slice(
      RAW.indexOf("create table if not exists public.foundry_event_assignments"),
      RAW.indexOf("foundry_event_assignment_one_claim_per_participant"),
    );
    expect(assignBlock).not.toMatch(/on delete cascade[^,]*bty_org_memberships/i);
    expect(assignBlock).not.toMatch(/membership_id[^,]*on delete restrict/i);
  });

  it("append-only audit: no hard delete, revoke is a recorded status change", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_event_assignment_audit/i);
    expect(SQL).toMatch(/check \(action in \('assign', 'claim', 'complete', 'revoke'\)\)/i);
    expect(CODE).not.toMatch(/delete from public\.foundry_event_assignment/i);
    expect(CODE).not.toMatch(/update public\.foundry_event_assignment_audit/i);
  });

  it("all four tables are client-deny (RLS + revoke)", () => {
    for (const t of [
      "foundry_event_participation_mode",
      "foundry_event_audience_snapshot",
      "foundry_event_assignments",
      "foundry_event_assignment_audit",
    ]) {
      expect(SQL).toMatch(new RegExp(`revoke all on public\\.${t} from anon, public, authenticated`, "i"));
      expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
  });

  it("secure-boundary RPC: Host + active + same-org, user derived from membership, service-role only", () => {
    expect(SQL).toMatch(/create or replace function public\.bty_foundry_validate_assignment/i);
    expect(SQL).toMatch(/security definer set search_path = pg_catalog, public/i);
    // the three authorization checks
    expect(SQL).toMatch(/raise exception 'not_a_host'/i);
    expect(SQL).toMatch(/raise exception 'membership_inactive'/i);
    expect(SQL).toMatch(/raise exception 'cross_organization'/i);
    // canonical user derived from the membership row, not a parameter
    expect(SQL).toMatch(/target_user_id := v_muser/i);
    expect(SQL).not.toMatch(/p_target_user_id|p_user_id/i);
    // service-role only
    expect(SQL).toMatch(
      /revoke execute on function public\.bty_foundry_validate_assignment\(uuid, uuid, uuid\) from public, anon, authenticated/i,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.bty_foundry_validate_assignment\(uuid, uuid, uuid\) to service_role/i,
    );
  });

  it("touches NO existing Foundry room behavior, XP, identity, or reflection data", () => {
    // never mutates existing foundry tables
    expect(CODE).not.toMatch(/alter table public\.foundry_events/i);
    expect(CODE).not.toMatch(/alter table public\.foundry_event_participants/i);
    expect(CODE).not.toMatch(/update public\.foundry_event_participants/i);
    // no reflection/response bodies copied into assignment tables
    expect(CODE).not.toMatch(/response_text/i);
    expect(CODE).not.toMatch(/reflection/i);
    // no XP / arena / responsibility / learning-path surface
    expect(CODE).not.toMatch(/\b(total_xp|weekly_xp|core_xp|lifetime_xp|xp_awarded)\b/i);
    expect(CODE).not.toMatch(/\blearning_path/i);
    expect(CODE).not.toMatch(/\bbty_org_membership_responsibilities\b/i);
  });

  it("is copy-friendly (LF header + trailing newline)", () => {
    expect(RAW.startsWith("-- Copy-friendly (LF, no trailing spaces). Select all to copy.")).toBe(true);
    expect(RAW.endsWith("\n")).toBe(true);
  });
});
