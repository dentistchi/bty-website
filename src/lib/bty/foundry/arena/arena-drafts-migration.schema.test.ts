import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the (unapplied) Guided Arena Builder migration. A real
 * Postgres is not available in unit CI, so this asserts the DDL DECLARES the
 * integrity rules the slice requires — so a future edit can't silently drop them.
 * Actual constraint enforcement is verified against Postgres at apply time.
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
  "20260717010000_foundry_arena_scenario_drafts_v1.sql",
);
const SQL = readFileSync(MIGRATION, "utf8").replace(/\s+/g, " ");

describe("Foundry arena scenario drafts migration integrity (schema-intent)", () => {
  it("creates the drafts table idempotently", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_arena_scenario_drafts/i);
  });

  it("binds the EXACT source module version (event id + version int + source draft id)", () => {
    expect(SQL).toMatch(/source_event_id uuid not null references public\.foundry_events \(id\) on delete cascade/i);
    expect(SQL).toMatch(/source_module_version int not null/i);
    expect(SQL).toMatch(/check\s*\(\s*source_module_version >= 1\s*\)/i);
    expect(SQL).toMatch(/source_draft_id uuid not null references public\.foundry_module_drafts \(id\)/i);
  });

  it("does NOT cascade-delete on the source module draft (version lineage protected)", () => {
    expect(SQL).not.toMatch(
      /source_draft_id uuid not null references public\.foundry_module_drafts \(id\) on delete/i,
    );
  });

  it("status is exactly 'draft' in V1 (never auto-publishes)", () => {
    expect(SQL).toMatch(/check\s*\(\s*status in \('draft'\)\s*\)/i);
  });

  it("carries guided answers + scenario draft jsonb + a revision counter", () => {
    expect(SQL).toMatch(/guided_answers jsonb not null default '\{\}'::jsonb/i);
    expect(SQL).toMatch(/scenario_draft jsonb/i);
    expect(SQL).toMatch(/revision int not null default 0/i);
    expect(SQL).toMatch(/check\s*\(\s*revision >= 0\s*\)/i);
  });

  it("bounds generation_source to ai|template|edited or null", () => {
    expect(SQL).toMatch(/generation_source is null or generation_source in \('ai', 'template', 'edited'\)/i);
  });

  it("is client-deny (RLS on, no anon/authenticated grant, no policy)", () => {
    expect(SQL).toMatch(/revoke all on public\.foundry_arena_scenario_drafts from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_arena_scenario_drafts enable row level security/i);
    expect(SQL).not.toMatch(/create policy[^;]*on public\.foundry_arena_scenario_drafts/i);
    expect(SQL).not.toMatch(
      /grant (select|insert|update|delete)[^;]*public\.foundry_arena_scenario_drafts to (anon|authenticated)/i,
    );
  });

  it("has owner hot-path indexes", () => {
    expect(SQL).toMatch(/foundry_arena_scenario_drafts_owner_updated_idx[^;]*\(owner_user_id, updated_at desc\)/i);
    expect(SQL).toMatch(/foundry_arena_scenario_drafts_owner_event_idx[^;]*\(owner_user_id, source_event_id\)/i);
  });

  it("introduces no XP/league/season/weekly COLUMN (Core vs Weekly XP untouched)", () => {
    // Column-name tokens only — the header comment legitimately mentions these words.
    expect(SQL).not.toMatch(/\b(weekly_xp|core_xp|league_id|week_id|season_id)\b/i);
  });

  it("does not seed any row or hardcoded identity", () => {
    expect(SQL).not.toMatch(/insert into public\.foundry_arena_scenario_drafts/i);
    expect(SQL).not.toMatch(/@/); // no email literal anywhere
  });

  it("rollback drops the table", () => {
    expect(SQL).toMatch(/drop table if exists public\.foundry_arena_scenario_drafts/i);
  });
});
