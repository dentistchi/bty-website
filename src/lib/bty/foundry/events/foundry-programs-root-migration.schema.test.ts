import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.2C — schema-intent guard for the Minimal Program Root migration.
 * Additive only: ONE canonical org-scoped Program identity root + NULLABLE
 * program_id lineage on the existing authoring draft and runtime event + one
 * service-role SECURITY DEFINER best-effort resolve-or-create RPC. RLS
 * default-deny; no Live Experience / Activity / Checkpoint; no assignment /
 * participation / QR / XP change; no historical backfill; canonical org identity
 * only (never legacy `memberships`); title never dedups identities.
 */
const RAW = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260801000000_foundry_programs_root_v1.sql"),
  "utf8",
);
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase();

describe("foundry-programs-root migration (schema-intent)", () => {
  it("creates the foundry_programs identity root (idempotent)", () => {
    expect(CODE).toMatch(/create table if not exists public\.foundry_programs/);
  });

  it("has org-scoped identity columns with durability snapshot", () => {
    for (const col of [
      "organization_id uuid not null references public.bty_organizations (id) on delete restrict",
      "owner_user_id uuid null references auth.users (id) on delete set null",
      "owner_user_id_snapshot uuid not null",
      "title text not null",
      "status text not null default 'active'",
    ]) {
      expect(CODE).toContain(col);
    }
  });

  it("constrains lifecycle and title (title bound is not a dedup key)", () => {
    expect(CODE).toMatch(/check \(status in \('active', 'retired'\)\)/);
    expect(CODE).toMatch(/char_length\(btrim\(title\)\) between 1 and 120/);
  });

  it("creates lineage lookup indexes", () => {
    expect(CODE).toMatch(/create index if not exists foundry_programs_org_created_idx/);
    expect(CODE).toMatch(/foundry_module_drafts_program_idx[\s\S]*where program_id is not null/);
    expect(CODE).toMatch(/foundry_events_program_idx[\s\S]*where program_id is not null/);
  });

  it("RLS default-deny on foundry_programs (no client policy, no broad grant)", () => {
    expect(CODE).toMatch(/revoke all on public\.foundry_programs from anon, public, authenticated/);
    expect(CODE).toMatch(/alter table public\.foundry_programs enable row level security/);
    expect(CODE).not.toMatch(/create policy[^;]*on public\.foundry_programs/);
    expect(CODE).not.toMatch(/using \(true\)/);
  });

  it("adds NULLABLE program_id lineage to BOTH existing tables (additive, SET NULL, IF NOT EXISTS)", () => {
    expect(CODE).toMatch(
      /alter table public\.foundry_module_drafts add column if not exists program_id uuid null references public\.foundry_programs \(id\) on delete set null/,
    );
    expect(CODE).toMatch(
      /alter table public\.foundry_events add column if not exists program_id uuid null references public\.foundry_programs \(id\) on delete set null/,
    );
  });

  it("defines a service-role-only SECURITY DEFINER resolve-or-create RPC", () => {
    expect(CODE).toMatch(/create or replace function public\.bty_foundry_resolve_or_create_program/);
    expect(CODE).toMatch(/security definer/);
    expect(CODE).toMatch(/set search_path = pg_catalog, public/);
    expect(CODE).toMatch(
      /revoke execute on function public\.bty_foundry_resolve_or_create_program\(uuid, text, uuid\)\s*from public, anon, authenticated/,
    );
    expect(CODE).toMatch(
      /grant execute on function public\.bty_foundry_resolve_or_create_program\(uuid, text, uuid\)\s*to service_role/,
    );
  });

  it("derives org from CANONICAL bty_org_memberships (never legacy memberships)", () => {
    expect(CODE).toMatch(/from public\.bty_org_memberships om/);
    expect(CODE).toMatch(/om\.status = 'active' and om\.is_primary = true/);
    // must not read the legacy membership table
    expect(CODE).not.toMatch(/from public\.memberships\b/);
    expect(CODE).not.toMatch(/from memberships\b/);
  });

  it("FAILS CLOSED for a NEW Program (no silent NULL): unresolved + ambiguous org raise", () => {
    expect(CODE).toMatch(/raise exception 'organization_unresolved'/);
    expect(CODE).toMatch(/raise exception 'organization_ambiguous'/);
    // the best-effort NULL-linkage create path must be GONE
    expect(CODE).not.toMatch(/program_id := null/);
  });

  it("fails closed on a supplied cross-org / missing Program (never links silently)", () => {
    expect(CODE).toMatch(/raise exception 'program_missing'/);
    expect(CODE).toMatch(/raise exception 'cross_organization'/);
  });

  it("does NOT dedup by title and touches no Live Experience / assignment / XP / QR objects", () => {
    expect(CODE).not.toMatch(/on conflict/);
    for (const forbidden of [
      "experience",
      "activity",
      "checkpoint",
      "foundry_event_assignments",
      "core_xp_ledger",
      "weekly_xp",
      "bty_action_contracts",
      "program_catalog",
      "bty_events ",
    ]) {
      expect(CODE).not.toContain(forbidden);
    }
  });
});
