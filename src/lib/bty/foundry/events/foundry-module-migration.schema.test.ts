import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the (unapplied) Guided Module Builder migration. A real
 * Postgres is not available in unit CI, so this asserts the DDL DECLARES the
 * integrity rules the Commander required — so a future edit can't silently drop
 * them. Actual constraint enforcement is verified against Postgres at apply time.
 */
const MIGRATION = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "20260716174444_foundry_module_builder_v1.sql",
);
const SQL = readFileSync(MIGRATION, "utf8").replace(/\s+/g, " ");

describe("Foundry module builder migration integrity (schema-intent)", () => {
  it("creates both tables", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_module_drafts/i);
    expect(SQL).toMatch(/create table if not exists public\.foundry_event_module/i);
  });

  it("drafts status is exactly draft|approved|published", () => {
    expect(SQL).toMatch(/check\s*\(\s*status in \('draft', 'approved', 'published'\)\s*\)/i);
  });

  it("drafts pin lifecycle-stamp consistency (approved->approved_at, published->both)", () => {
    expect(SQL).toMatch(/status = 'draft' and approved_at is null and published_at is null/i);
    expect(SQL).toMatch(/status = 'approved' and approved_at is not null and published_at is null/i);
    expect(SQL).toMatch(/status = 'published' and approved_at is not null and published_at is not null/i);
  });

  it("drafts carry version lineage (module_version >= 1, parent_module_id self-FK)", () => {
    expect(SQL).toMatch(/module_version int not null default 1/i);
    expect(SQL).toMatch(/check\s*\(\s*module_version >= 1\s*\)/i);
    expect(SQL).toMatch(/parent_module_id uuid references public\.foundry_module_drafts \(id\)/i);
  });

  it("document_asset_ref is optional and bounded (opaque, not a URL/path)", () => {
    expect(SQL).toMatch(/document_asset_ref text/i);
    expect(SQL).toMatch(/document_asset_ref is null or char_length\(btrim\(document_asset_ref\)\) between 1 and 200/i);
  });

  it("event_module is 1:1 with the event (event_id PK/FK to foundry_events)", () => {
    expect(SQL).toMatch(
      /event_id uuid primary key references public\.foundry_events \(id\) on delete cascade/i,
    );
  });

  it("event_module.source_draft_id is NOT NULL and UNIQUE (publish idempotency boundary)", () => {
    expect(SQL).toMatch(/source_draft_id uuid not null references public\.foundry_module_drafts \(id\)/i);
    expect(SQL).toMatch(/unique \(source_draft_id\)/i);
  });

  it("event_module.source_draft_id FK does NOT cascade-delete (published draft is protected)", () => {
    // the source_draft_id FK line must not carry an on-delete cascade/set-null clause.
    expect(SQL).not.toMatch(
      /source_draft_id uuid not null references public\.foundry_module_drafts \(id\) on delete/i,
    );
  });

  it("both tables are client-deny (RLS on, no anon/authenticated grant, no policy)", () => {
    expect(SQL).toMatch(/revoke all on public\.foundry_module_drafts from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_module_drafts enable row level security/i);
    expect(SQL).toMatch(/revoke all on public\.foundry_event_module from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_event_module enable row level security/i);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.foundry_module_drafts/i);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.foundry_event_module/i);
    expect(SQL).not.toMatch(/grant (select|insert|update|delete)[^;]*public\.foundry_module_drafts to (anon|authenticated)/i);
    expect(SQL).not.toMatch(/grant (select|insert|update|delete)[^;]*public\.foundry_event_module to (anon|authenticated)/i);
  });

  it("owner-hot-path indexes exist", () => {
    expect(SQL).toMatch(/foundry_module_drafts_owner_updated_idx[^;]*\(owner_user_id, updated_at desc\)/i);
    expect(SQL).toMatch(/foundry_module_drafts_owner_status_idx[^;]*\(owner_user_id, status\)/i);
  });

  it("does not seed any row or hardcoded identity", () => {
    expect(SQL).not.toMatch(/insert into public\.foundry_module_drafts/i);
    expect(SQL).not.toMatch(/insert into public\.foundry_event_module/i);
    expect(SQL).not.toMatch(/@/); // no email literal anywhere
  });

  it("rollback drops both tables in dependency order", () => {
    expect(SQL).toMatch(/drop table if exists public\.foundry_event_module/i);
    expect(SQL).toMatch(/drop table if exists public\.foundry_module_drafts/i);
  });
});
