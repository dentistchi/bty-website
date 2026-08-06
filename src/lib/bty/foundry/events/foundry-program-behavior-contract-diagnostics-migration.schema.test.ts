import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_FIELDS, CONTRACT_FIELD_STORAGE, CONTRACT_DEFECT_REASONS } from "@/domain/foundry/module/program-coherence";

/**
 * Slice 3.2L-R7 — static guard for the behaviour-contract diagnostics migration.
 *
 * It is SHADOW-PROVEN on PostgreSQL 17.6.1.075 against a seeded 8-parent / 9-child replica
 * built by replaying the real 20260807, 20260808 and 20260809 migrations — 13/13 gates. It
 * is NOT applied live; that is a Founder SQL gate. These assertions are the cheap always-on
 * half: the file stays additive, single-table, prose-free, and its vocabularies stay equal
 * to the domain validator's own.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260810000000_foundry_program_behavior_contract_diagnostics_v1.sql"),
  "utf8",
);
const EXECUTABLE = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("[3.2L-R7] behaviour-contract diagnostics migration", () => {
  it("touches only the child call table", () => {
    const tables = [...EXECUTABLE.matchAll(/alter table (\S+)/gi)].map((m) => m[1]);
    expect(new Set(tables)).toEqual(new Set(["public.foundry_program_generation_attempt_calls"]));
  });

  it("is additive only — no drop, update, delete, insert or backfill", () => {
    for (const forbidden of [/\bdrop\s+table\b/i, /\bdrop\s+column\b/i, /\bupdate\s+/i, /\bdelete\s+from\b/i, /\btruncate\b/i, /\binsert\s+into\b/i]) {
      expect(forbidden.test(EXECUTABLE), `must not contain ${forbidden}`).toBe(false);
    }
    expect((EXECUTABLE.match(/add column if not exists/gi) ?? []).length).toBe(2);
  });

  it("changes no RLS, policy, grant or existing constraint, and is transactional", () => {
    for (const forbidden of [/row level security/i, /create policy/i, /drop policy/i, /\bgrant\b/i, /\brevoke\b/i, /drop constraint/i, /create index/i]) {
      expect(forbidden.test(EXECUTABLE), `must not contain ${forbidden}`).toBe(false);
    }
    expect(/^begin;/m.test(EXECUTABLE)).toBe(true);
    expect(/^commit;/m.test(EXECUTABLE)).toBe(true);
    expect(/not null/i.test(EXECUTABLE)).toBe(false);
  });

  it("the FIELD vocabulary equals the validator's stored spellings exactly", () => {
    const m = EXECUTABLE.match(/behavior_contract_field in \(([\s\S]*?)\)/i);
    const allowed = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(allowed).toEqual(CONTRACT_FIELDS.map((f) => CONTRACT_FIELD_STORAGE[f]).sort());
    // The camelCase domain spelling must NOT be storable — one spelling, not two.
    expect(allowed).not.toContain("observableAction");
  });

  it("the REASON vocabulary equals the validator's own exactly", () => {
    const m = EXECUTABLE.match(/behavior_contract_reason in \(([\s\S]*?)\)/i);
    const allowed = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(allowed).toEqual([...CONTRACT_DEFECT_REASONS].sort());
  });

  it("neither column can hold prose", () => {
    const added = [...EXECUTABLE.matchAll(/add column if not exists (\w+) text/gi)].map((m) => m[1]);
    expect(added).toEqual(["behavior_contract_field", "behavior_contract_reason"]);
    for (const col of added) expect(new RegExp(`${col} in \\(`, "i").test(EXECUTABLE), col).toBe(true);
  });

  it("MUTATION PROOF — the checks reject a careless edit", () => {
    expect(/\bupdate\s+/i.test(`${EXECUTABLE}\nupdate public.x set y = 'z';`)).toBe(true);
    expect(/\bgrant\b/i.test(`${EXECUTABLE}\ngrant select on public.x to anon;`)).toBe(true);
    const freeText = EXECUTABLE.replace(/behavior_contract_reason text[\s\S]*?\)\);/, "behavior_contract_reason text;");
    expect(/behavior_contract_reason in \(/i.test(freeText)).toBe(false);
  });
});
