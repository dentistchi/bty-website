import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.1B-3J — schema-intent guard for the consent migration. Additive column on the settled
 * per-user preference table, NOT NULL DEFAULT false (legacy rows get false), idempotent, rollback.
 */
const RAW = readFileSync(join(process.cwd(), "supabase", "migrations", "20260727000000_personalize_today_from_reflections_v1.sql"), "utf8");
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");

describe("personalize-today migration (schema-intent)", () => {
  it("adds the consent boolean to the existing preference table, NOT NULL DEFAULT false, idempotent", () => {
    expect(CODE).toMatch(/alter table public\.user_conversation_preferences add column if not exists personalize_today_from_reflections boolean not null default false/i);
  });
  it("creates NO new table and moves NO reflection content (only the additive column)", () => {
    expect(CODE).not.toMatch(/create table/i);
    // never touches the private reflection body, and performs no data movement
    expect(CODE).not.toMatch(/response_text/i);
    expect(CODE).not.toMatch(/\binsert\s+into\b|\bupdate\s+public\b/i);
  });
  it("documents a rollback", () => {
    expect(RAW).toMatch(/drop column if exists personalize_today_from_reflections/i);
  });
});
