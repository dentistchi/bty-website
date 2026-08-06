import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Slice 3.2L-R3 CALL-LEVEL CORRECTION — static guard on the diagnostics migration.
 *
 * The first version of this migration put the diagnosis on the PARENT attempt. That cannot
 * hold the evidence: an attempt makes up to two provider calls, and they can fail at
 * different paths with different types. A single parent column can hold one of those, so
 * the second write either overwrites the first or silently disagrees with it. The
 * diagnosis belongs to the CALL that produced it.
 *
 * This test reads the SQL the Founder will execute and asserts what that file may and may
 * not contain — before it is ever run. It is the last check that stands between a wrong
 * schema and a live database.
 */

const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260808000000_foundry_program_generation_structural_diagnostics_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");

/** Comments carry the reasoning, including words we forbid in EXECUTABLE SQL. Strip them. */
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase().trim();

const CHILD = "public.foundry_program_generation_attempt_calls";
const PARENT = "public.foundry_program_generation_attempts";
const DIAGNOSTIC_COLUMNS = [
  "validation_stage",
  "offending_path",
  "expected_type",
  "actual_type",
  "structural_retryable",
] as const;

describe("[3.2L-R3] program call diagnostics migration (static contract)", () => {
  it("targets the CHILD call table", () => {
    expect(CODE).toContain(`alter table ${CHILD}`);
  });

  it("adds exactly the five intended diagnostic columns, each idempotently", () => {
    for (const col of DIAGNOSTIC_COLUMNS) {
      expect(CODE, `${col} must be added with "if not exists"`).toMatch(
        new RegExp(`add column if not exists ${col}\\b`),
      );
    }
    // No sixth column smuggled in: count every add-column in the file.
    const added = [...CODE.matchAll(/add column(?: if not exists)? (\w+)/g)].map((m) => m[1]);
    expect([...added].sort()).toEqual([...DIAGNOSTIC_COLUMNS].sort());
  });

  it("does NOT add failed_call_sequence — call_sequence already identifies the call", () => {
    expect(CODE).not.toContain("failed_call_sequence");
  });

  it("leaves the PARENT attempt table completely untouched", () => {
    expect(CODE, "the parent table must not be altered at all").not.toContain(`alter table ${PARENT}`);
    // Guard the exact-name case too: `..._attempts` is a prefix of `..._attempt_calls`, so a
    // substring check alone would pass on the child. Match the parent name at a word boundary.
    expect(CODE).not.toMatch(new RegExp(`alter table ${PARENT.replace(/\./g, "\\.")}(?![_a-z])`));
  });

  it("every column is nullable — no NOT NULL, no DEFAULT, no backfill of historical rows", () => {
    expect(CODE).not.toMatch(/add column[^,;]*not null/);
    expect(CODE).not.toMatch(/add column[^,;]*default/);
    expect(CODE, "historical evidence is never rewritten").not.toMatch(/\bupdate\s+public\./);
  });

  it("contains no executable destructive statement", () => {
    for (const verb of ["drop table", "drop column", "truncate", "delete from", "drop index"]) {
      expect(CODE, `"${verb}" must not appear in executable SQL`).not.toContain(verb);
    }
    // …while the reviewed rollback is still documented in comments.
    expect(RAW).toContain("ROLLBACK (reviewed, NOT executed)");
    expect(RAW).toMatch(/--\s*drop column if exists validation_stage/);
  });

  it("bounds what may be stored, so a path can never become a prose field", () => {
    expect(CODE).toMatch(/validation_stage is null or validation_stage in \('structural', 'semantic'\)/);
    expect(CODE).toMatch(/length\(offending_path\) <= \d+/);
    expect(CODE).toMatch(/length\(expected_type\) <= \d+/);
    // actual_type is a closed vocabulary: the missing/object distinction is the whole point.
    for (const t of ["missing", "null", "string", "object", "array", "number", "boolean"]) {
      expect(CODE).toContain(`'${t}'`);
    }
  });

  it("indexes the child table, not the parent", () => {
    expect(CODE).toMatch(new RegExp(`create index if not exists \\w+ on ${CHILD.replace(/\./g, "\\.")}`));
  });

  it("runs as one transaction", () => {
    expect(CODE.startsWith("begin;")).toBe(true);
    expect(CODE.endsWith("commit;")).toBe(true);
  });

  it("is copy-friendly: LF only, no trailing whitespace, single trailing newline", () => {
    expect(RAW.split("\n")[0]).toBe("-- Copy-friendly (LF, no trailing spaces). Select all to copy.");
    expect(RAW).not.toContain("\r");
    expect(RAW.split("\n").filter((l) => /\s$/.test(l))).toEqual([]);
    expect(RAW.endsWith("\n") && !RAW.endsWith("\n\n")).toBe(true);
  });
});
