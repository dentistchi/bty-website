import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSTRUCT_NOUNS, nounStem } from "@/domain/foundry/module/program-coherence";
import { JOURNEY_KIND_ORDER } from "@/domain/foundry/module/journey";

/**
 * Slice 3.2L-R6 — STATIC proof for the dependency-diagnostics migration.
 *
 * The migration is SHADOW-PROVEN on PostgreSQL 17.6.1.075 (Slice 3.2L-R6.1) against a
 * seeded 7-parent / 8-child replica built by replaying the real 20260807 and 20260808
 * migrations — applied, re-applied, rolled back and re-applied, with the pre-existing-column
 * digest byte-identical throughout. An earlier note here claimed a shadow proof was
 * impossible without the live database password; that was wrong, and the correction matters:
 * an ISOLATED LOCAL container needs only a local credential and never touches the live project.
 *
 * These static assertions remain as the cheap, always-on guard. What they prove: the file is additive-only, touches one table, writes no rows,
 * grants nothing, and its controlled vocabularies match the domain's own closed lists — so
 * a value the validator can produce cannot be rejected by a CHECK, and a column cannot hold
 * generated prose.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260809000000_foundry_program_dependency_diagnostics_v1.sql"),
  "utf8",
);

/** Statements only — comments carry a documented rollback that must not be read as DDL. */
const EXECUTABLE = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("[3.2L-R6] dependency diagnostics migration is additive and prose-free", () => {
  it("touches only the child call table", () => {
    const tables = [...EXECUTABLE.matchAll(/alter table (\S+)/gi)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["public.foundry_program_generation_attempt_calls"]));
  });

  it("is additive only — no drop, no update, no delete, no backfill", () => {
    for (const forbidden of [/\bdrop\s+table\b/i, /\bdrop\s+column\b/i, /\bupdate\s+/i, /\bdelete\s+from\b/i, /\btruncate\b/i, /\binsert\s+into\b/i]) {
      expect(forbidden.test(EXECUTABLE), `executable SQL must not contain ${forbidden}`).toBe(false);
    }
    expect((EXECUTABLE.match(/add column if not exists/gi) ?? []).length).toBe(3);
  });

  it("changes no RLS, policy, grant or existing constraint", () => {
    for (const forbidden of [/row level security/i, /create policy/i, /drop policy/i, /\bgrant\b/i, /\brevoke\b/i, /drop constraint/i]) {
      expect(forbidden.test(EXECUTABLE), `must not contain ${forbidden}`).toBe(false);
    }
  });

  it("is transactional", () => {
    expect(/^begin;/m.test(EXECUTABLE)).toBe(true);
    expect(/^commit;/m.test(EXECUTABLE)).toBe(true);
  });

  it("every new column is nullable, so historical rows stay honestly NULL", () => {
    expect(/not null/i.test(EXECUTABLE)).toBe(false);
  });

  it("the branch vocabulary matches the domain exactly", () => {
    const m = EXECUTABLE.match(/dependency_branch in \(([\s\S]*?)\)/i);
    expect(m).toBeTruthy();
    const allowed = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(allowed).toEqual(["authority_mismatch", "defined_after_use", "used_before_defined"]);
  });

  it("the construct vocabulary is the domain's closed list — no value can be rejected", () => {
    const m = EXECUTABLE.match(/dependency_construct_kind in \(([\s\S]*?)\)/i);
    const allowed = new Set([...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
    for (const noun of CONSTRUCT_NOUNS) {
      expect(allowed.has(nounStem(noun)), `stem "${nounStem(noun)}" must be storable`).toBe(true);
    }
    // NULL, never a sentinel: "no construct applies" must not be a storable string.
    expect(allowed.has("none")).toBe(false);
  });

  it("the counterpart vocabulary is exactly the Journey kinds", () => {
    const m = EXECUTABLE.match(/dependency_counterpart_kind in \(([\s\S]*?)\)/i);
    const allowed = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(allowed).toEqual([...JOURNEY_KIND_ORDER].sort());
  });

  it("no column can hold prose — every new column is CHECK-constrained to a fixed list", () => {
    const added = [...EXECUTABLE.matchAll(/add column if not exists (\w+) text/gi)].map((m) => m[1]);
    expect(added).toHaveLength(3);
    for (const col of added) {
      expect(new RegExp(`${col} in \\(`, "i").test(EXECUTABLE), `${col} must be constrained to a fixed vocabulary`).toBe(true);
    }
  });

  it("MUTATION PROOF — the checks above reject a wrong migration", () => {
    // Each mutation is what a careless edit would look like; the assertions must not pass.
    const withBackfill = `${EXECUTABLE}\nupdate public.foundry_program_generation_attempt_calls set dependency_branch = 'used_before_defined';`;
    expect(/\bupdate\s+/i.test(withBackfill)).toBe(true);
    const withGrant = `${EXECUTABLE}\ngrant select on public.foundry_program_generation_attempt_calls to anon;`;
    expect(/\bgrant\b/i.test(withGrant)).toBe(true);
    const freeText = EXECUTABLE.replace(/dependency_branch text[\s\S]*?\)\);/, "dependency_branch text;");
    expect(/dependency_branch in \(/i.test(freeText)).toBe(false);
  });
});
