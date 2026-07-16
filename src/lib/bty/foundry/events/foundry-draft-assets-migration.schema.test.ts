import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the (unapplied) Draft Assets migration. Postgres is not
 * available in unit CI, so this asserts the DDL DECLARES the integrity rules the
 * Commander required — so a future edit can't silently drop them. Enforcement is
 * verified against Postgres at apply time.
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
  "20260716213639_foundry_module_draft_assets_v1.sql",
);
const SQL = readFileSync(MIGRATION, "utf8").replace(/\s+/g, " ");

describe("Foundry draft assets migration integrity (schema-intent)", () => {
  it("creates the additive table", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_module_draft_assets/i);
  });

  it("does NOT modify or drop foundry_module_drafts / document_asset_ref", () => {
    expect(SQL).not.toMatch(/alter table public\.foundry_module_drafts/i);
    expect(SQL).not.toMatch(/drop column[^;]*document_asset_ref/i);
  });

  it("cascades from the draft and carries NO redundant owner column", () => {
    expect(SQL).toMatch(/draft_id uuid not null references public\.foundry_module_drafts \(id\) on delete cascade/i);
    // no owner_user_id COLUMN (a comment may still reference the drafts.owner_user_id chain).
    expect(SQL).not.toMatch(/owner_user_id\s+uuid/i);
  });

  it("constrains file_kind to the safe category set", () => {
    expect(SQL).toMatch(
      /check \(file_kind in \('pdf', 'document', 'spreadsheet', 'presentation', 'text', 'image'\)\)/i,
    );
  });

  it("keeps the private storage location server-only (bucket + path columns, not URLs)", () => {
    expect(SQL).toMatch(/storage_bucket text not null/i);
    expect(SQL).toMatch(/storage_path text not null/i);
    expect(SQL).toMatch(/char_length\(btrim\(storage_path\)\) between 1 and 400/i);
    expect(SQL).toMatch(/content_hash text not null/i);
  });

  it("bounds byte_size (per-file cap) and image dimensions", () => {
    expect(SQL).toMatch(/byte_size between 1 and 26214400/i);
    expect(SQL).toMatch(/width is null or width between 1 and 100000/i);
    expect(SQL).toMatch(/height is null or height between 1 and 100000/i);
  });

  it("has a unique storage_path and the draft-ordered index", () => {
    expect(SQL).toMatch(/unique \(storage_path\)/i);
    expect(SQL).toMatch(/foundry_module_draft_assets_draft_created_idx[^;]*\(draft_id, created_at\)/i);
  });

  it("is client-deny (RLS on, no policy, no anon/authenticated grant)", () => {
    expect(SQL).toMatch(/revoke all on public\.foundry_module_draft_assets from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_module_draft_assets enable row level security/i);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.foundry_module_draft_assets/i);
    expect(SQL).not.toMatch(/grant (select|insert|update|delete)[^;]*public\.foundry_module_draft_assets to (anon|authenticated)/i);
  });

  it("seeds nothing and hardcodes no identity", () => {
    expect(SQL).not.toMatch(/insert into public\.foundry_module_draft_assets/i);
    expect(SQL).not.toMatch(/@/);
  });

  it("rollback drops the new table", () => {
    expect(SQL).toMatch(/drop table if exists public\.foundry_module_draft_assets/i);
  });
});
