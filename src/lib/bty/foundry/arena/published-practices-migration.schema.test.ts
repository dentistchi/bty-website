import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schema-intent guard for the (Slice 3.0B) published-practices migration. Asserts
 * the DDL DECLARES the integrity + isolation rules the slice requires so a future
 * edit can't silently drop them. Actual enforcement is verified against Postgres
 * at apply time.
 */
const SQL = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "supabase", "migrations", "20260717020000_foundry_published_arena_practices_v1.sql"),
  "utf8",
).replace(/\s+/g, " ");

describe("Foundry published arena practices migration integrity (schema-intent)", () => {
  it("creates both tables idempotently", () => {
    expect(SQL).toMatch(/create table if not exists public\.foundry_published_arena_practices/i);
    expect(SQL).toMatch(/create table if not exists public\.foundry_arena_practice_runs/i);
  });

  it("preserves full source lineage (draft + revision + event + module version)", () => {
    expect(SQL).toMatch(/source_draft_id uuid not null references public\.foundry_arena_scenario_drafts \(id\)/i);
    expect(SQL).toMatch(/source_draft_revision int not null/i);
    expect(SQL).toMatch(/source_event_id uuid not null references public\.foundry_events \(id\)/i);
    expect(SQL).toMatch(/source_module_version int not null/i);
  });

  it("freezes an immutable snapshot + status published|retired", () => {
    expect(SQL).toMatch(/scenario_snapshot jsonb not null/i);
    expect(SQL).toMatch(/check \(status in \('published', 'retired'\)\)/i);
  });

  it("enforces publish idempotency via UNIQUE(source_draft_id, source_draft_revision)", () => {
    expect(SQL).toMatch(/unique \(source_draft_id, source_draft_revision\)/i);
  });

  it("practice_runs is ISOLATED from arena_runs and has NO XP column", () => {
    // references the published practice, not public.arena_runs
    expect(SQL).toMatch(/practice_id uuid not null references public\.foundry_published_arena_practices \(id\)/i);
    // no XP/points COLUMN anywhere -> zero XP by construction (comments may mention xp)
    expect(SQL).not.toMatch(/\b(total_xp|weekly_xp|core_xp)\b/i);
    // never has a FK/DDL reference to the canonical arena_runs table (comment mention is fine)
    expect(SQL).not.toMatch(/references public\.arena_runs/i);
  });

  it("practice_runs status is in_progress|completed with a completion stamp check", () => {
    expect(SQL).toMatch(/check \(status in \('in_progress', 'completed'\)\)/i);
    expect(SQL).toMatch(/status = 'completed' and completed_at is not null/i);
  });

  it("both tables are client-deny (RLS on, no policy, no anon/authenticated grant)", () => {
    expect(SQL).toMatch(/revoke all on public\.foundry_published_arena_practices from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_published_arena_practices enable row level security/i);
    expect(SQL).toMatch(/revoke all on public\.foundry_arena_practice_runs from anon, public, authenticated/i);
    expect(SQL).toMatch(/alter table public\.foundry_arena_practice_runs enable row level security/i);
    expect(SQL).not.toMatch(/create policy/i);
  });

  it("does not reference/alter public.scenarios or seed any row", () => {
    // no DDL/FK reference to the canonical scenario content table (comment mention is fine)
    expect(SQL).not.toMatch(/references public\.scenarios/i);
    expect(SQL).not.toMatch(/(alter|create) table[^;]*public\.scenarios/i);
    expect(SQL).not.toMatch(/insert into/i);
    expect(SQL).not.toMatch(/@/);
  });

  it("rollback drops both tables in dependency order", () => {
    expect(SQL).toMatch(/drop table if exists public\.foundry_arena_practice_runs/i);
    expect(SQL).toMatch(/drop table if exists public\.foundry_published_arena_practices/i);
  });
});
