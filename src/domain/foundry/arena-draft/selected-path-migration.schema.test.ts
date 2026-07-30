import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static guard on the Slice 3.2I migration: it must be purely ADDITIVE, NULLABLE, and
 * idempotent — no default, backfill, NOT NULL, index, RLS/trigger change, or row rewrite.
 * The migration is NOT applied by any test; this only inspects its SQL text.
 */
const RAW = readFileSync(
  join(process.cwd(), "supabase/migrations/20260802000000_foundry_practice_run_selected_path_v1.sql"),
  "utf8",
).toLowerCase();
// Executable SQL only — strip `--` comment lines so prose ("no default…") never trips the guards.
const SQL = RAW.split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");

describe("selected_path migration — additive/nullable/idempotent", () => {
  it("adds a nullable jsonb column idempotently", () => {
    expect(SQL).toContain("add column if not exists selected_path jsonb null");
    expect(SQL).toContain("public.foundry_arena_practice_runs");
  });

  it("guards the shape as a json object (or null)", () => {
    expect(SQL).toContain("jsonb_typeof(selected_path) = 'object'");
    expect(SQL).toContain("selected_path is null");
  });

  it("does NOT add a default, NOT NULL, index, backfill, RLS, or trigger", () => {
    expect(SQL).not.toContain("default");
    expect(SQL).not.toMatch(/not\s+null\s*;/); // no NOT NULL column
    expect(SQL).not.toContain("create index");
    expect(SQL).not.toContain("update public.foundry_arena_practice_runs set"); // no backfill
    expect(SQL).not.toContain("create policy");
    expect(SQL).not.toContain("create trigger");
    expect(SQL).not.toContain("drop ");
  });
});
