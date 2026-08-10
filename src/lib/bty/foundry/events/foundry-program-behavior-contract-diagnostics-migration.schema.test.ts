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

  /**
   * THE VOCABULARY IS NOW SPREAD ACROSS TWO MIGRATIONS (Slice 3.2P-R2.1).
   *
   * This migration pinned six reasons. The observable-action grammar floor adds a seventh,
   * `interrogative_action`, widened by `20260816000000` — Founder-applied and independently
   * probed live in Slice 3.2P-R3. While the two were out of step the recorder wrote NULL
   * rather than a value the live schema would refuse (`storableContractReason`), so no insert
   * could ever fail on it; that guard stays, for the next time the domain moves first.
   *
   * The invariant this test exists for is unchanged — the schema and the validator must agree
   * on the vocabulary — so it is now asserted against the UNION of the two migrations, and the
   * older file is still asserted to be exactly what it was.
   */
  it("the REASON vocabulary, across both migrations, equals the validator's own exactly", () => {
    const reasonsIn = (sql: string) => {
      const m = sql.match(/behavior_contract_reason in \(([\s\S]*?)\)/i);
      return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
    };
    // This migration, unchanged: the original six.
    expect(reasonsIn(EXECUTABLE).sort()).toEqual(
      ["meta_only", "missing", "no_confirmation", "no_moment", "not_a_role", "too_long"],
    );

    /*
      The vocabulary now spans THREE migrations: this one, `20260816000000` (interrogative_action,
      applied) and `20260818000000` (actor_unauthorized / confirmer_unauthorized, held). Each
      later file restates the full list, so the union is what the schema will accept once all are
      applied — and `storableContractReason` withholds anything the LIVE check has not reached.
    */
    const executableOf = (file: string) =>
      readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8")
        .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    const union = [...new Set([
      ...reasonsIn(EXECUTABLE),
      ...reasonsIn(executableOf("20260816000000_foundry_program_contract_reason_interrogative_v1.sql")),
      ...reasonsIn(executableOf("20260818000000_foundry_program_contract_reason_role_authority_v1.sql")),
    ])].sort();
    expect(union).toEqual([...CONTRACT_DEFECT_REASONS].sort());
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
