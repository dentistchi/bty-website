import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Static guard on the Slice 3.2I-R5B1A.1(+R1) one-shell migration. It must create the EXACT
 * atomic invariant — a partial UNIQUE INDEX on (owner_user_id, source_event_id) scoped to
 * new-authority drafts — and it must FAIL CLOSED if a same-named index with a wrong definition
 * already exists (name-idempotence alone is not enough). The migration is NOT applied by any test;
 * this only inspects its SQL text.
 */
const PATH = join(process.cwd(), "supabase/migrations/20260803000000_foundry_arena_draft_one_shell_v1.sql");
const RAW = readFileSync(PATH, "utf8");
const RAW_LC = RAW.toLowerCase();
// Executable SQL only — strip `--` comment lines so prose never trips the destructive-op guards.
const SQL = RAW_LC.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

describe("one-shell migration — exact partial UNIQUE INDEX", () => {
  it("creates a UNIQUE INDEX on the exact table, idempotently (additive)", () => {
    expect(SQL).toContain("create unique index if not exists foundry_arena_scenario_drafts_one_shell_idx");
    expect(SQL).toContain("on public.foundry_arena_scenario_drafts");
  });

  it("keys on (owner_user_id, source_event_id) in that exact order", () => {
    expect(SQL).toMatch(/\(\s*owner_user_id\s*,\s*source_event_id\s*\)/);
  });

  it("is PARTIAL on the practiceSetupVersion-present predicate", () => {
    expect(SQL).toMatch(/where\s*\(\s*guided_answers\s*->>\s*'practicesetupversion'\s*\)\s*is not null/);
  });
});

describe("one-shell migration — fail-closed definition guard (R1)", () => {
  it("verifies an existing same-named index by CATALOG fields, not name alone", () => {
    // A DO block that inspects pg_index/pg_class before creating.
    expect(SQL).toContain("do $$");
    expect(SQL).toContain("pg_index");
    // unique + table + columns + predicate are each verified.
    expect(SQL).toContain("indisunique");
    expect(SQL).toContain("indkey"); // indexed columns, in order
    expect(SQL).toContain("indpred"); // partial predicate
    expect(SQL).toContain("pg_get_expr"); // renders the predicate for exact check
    expect(SQL).toContain("'owner_user_id,source_event_id'"); // exact expected key order
    expect(SQL).toContain("public.foundry_arena_scenario_drafts'::regclass");
  });

  it("RAISES (fails closed) when the existing definition differs", () => {
    // Non-index relation, wrong table, non-unique, wrong columns, non-partial, wrong predicate.
    const raises = (SQL.match(/raise exception/g) ?? []).length;
    expect(raises).toBeGreaterThanOrEqual(6);
    expect(SQL).toContain("is not unique");
    expect(SQL).toContain("wrong key columns");
    expect(SQL).toContain("is not partial");
  });

  it("closes the same-named NON-INDEX relation hole (create index if not exists would silently skip)", () => {
    // A table/view of the index name must fail closed, not be silently skipped.
    expect(SQL).toContain("relkind");
    expect(SQL).toContain("non-index relation");
    expect(SQL).toContain("left join pg_index"); // so a non-index relation is still detected
  });

  it("permits creation when the index is ABSENT (guard returns, does not raise)", () => {
    expect(SQL).toContain("if not found then");
    expect(SQL).toContain("return;");
  });
});

// ---------------------------------------------------------------------------
// R2 — EXACT predicate guard. The SQL normalizes only insignificant variance (whitespace, the
// PostgreSQL-added ::text cast, and pg_get_expr grouping parens) and then requires EXACT equality
// to the canonical predicate. `normalizePred` below MODELS that SQL exactly; the static assertions
// afterward bind the SQL text to this model so they cannot drift. (Real plpgsql execution against a
// wrong-definition index is proven once the migration is applied to a Postgres — see the report.)
// ---------------------------------------------------------------------------

/** Faithful model of the migration's predicate normalization (SQL: regexp_replace \s+, replace
 * ::text, translate '()'), preserving identifier/keyword case. */
function normalizePred(pgGetExpr: string): string {
  return pgGetExpr.replace(/\s+/g, "").replaceAll("::text", "").replace(/[()]/g, "");
}
const CANONICAL = "guided_answers->>'practiceSetupVersion'ISNOTNULL";
const accepts = (p: string) => normalizePred(p) === CANONICAL;

describe("one-shell predicate guard — EXACT normalized equality (R2 model)", () => {
  it("ACCEPTS the exact required predicate as PostgreSQL renders it", () => {
    expect(accepts("((guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL)")).toBe(true);
    // ... and formatting/whitespace variants of the same predicate
    expect(accepts("(guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL")).toBe(true);
    expect(accepts("((guided_answers->>'practiceSetupVersion') IS NOT NULL)")).toBe(true);
  });

  it("REJECTS every materially different predicate", () => {
    const bad = [
      "((guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL) OR true",       // 1 OR true
      "((guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL) AND (owner_user_id IS NOT NULL)", // 2 AND filter
      "((guided_answers ->> 'practiceSetupVersion'::text) = '1'::text)",               // 3 equals value, not presence
      "((guided_answers ->> 'practicesetupversion'::text) IS NOT NULL)",               // 4 wrong JSON key (case)
      "((guided_answers ->> 'setupVersion'::text) IS NOT NULL)",                       // 4b wrong JSON key
      "((scenario_draft ->> 'practiceSetupVersion'::text) IS NOT NULL)",               // 5 wrong JSON column
      "((guided_answers ->> 'practiceSetupVersion'::text) IS NULL)",                   // narrower/negated
      "(NOT ((guided_answers ->> 'practiceSetupVersion'::text) IS NOT NULL))",         // negated
      "((guided_answers -> 'practiceSetupVersion') IS NOT NULL)",                      // -> not ->> (json vs text)
    ];
    for (const p of bad) expect(accepts(p)).toBe(false);
  });

  it("REJECTS a non-partial index (null predicate) via the separate is-not-partial guard", () => {
    // A non-partial index has no indpred → the SQL raises 'is not partial' before this comparison.
    expect(SQL).toContain("is not partial");
  });

  it("the SQL implements THIS normalization + canonical (bind model↔migration)", () => {
    // Case-sensitive parts are asserted against RAW (SQL is lowercased) so the exact JSON-key case
    // and the uppercase IS NOT NULL in the canonical are actually verified.
    expect(RAW).toContain("regexp_replace(v_pred, '\\s+', '', 'g')");
    expect(RAW).toContain("replace(v_norm, '::text', '')");
    expect(RAW).toContain("translate(v_norm, '()', '')");
    expect(RAW).toContain("'guided_answers->>''practiceSetupVersion''ISNOTNULL'"); // exact, case-preserving
    // the OLD permissive substring check must be gone
    expect(SQL).not.toContain("position('practicesetupversion'");
  });
});

describe("one-shell migration — no cleanup, no side effects", () => {
  it("never deletes, merges, backfills, or drops rows/objects", () => {
    expect(SQL).not.toContain("delete from");
    expect(SQL).not.toMatch(/update\s+public\.foundry_arena_scenario_drafts\s+set/); // no backfill
    expect(SQL).not.toContain("drop index"); // rollback lives in a comment only
    expect(SQL).not.toContain("drop table");
    expect(SQL).not.toContain("truncate");
  });

  it("changes no RLS / grant / policy / trigger / default", () => {
    expect(SQL).not.toContain("create policy");
    expect(SQL).not.toContain("alter policy");
    expect(SQL).not.toContain("grant ");
    expect(SQL).not.toContain("create trigger");
    expect(SQL).not.toContain("default");
    expect(SQL).not.toContain("alter table"); // index-only migration
  });

  it("documents the read-only duplicate preflight + STOP rule (comments)", () => {
    expect(RAW_LC).toContain("duplicate preflight");
    expect(RAW_LC).toContain("having count(*) > 1");
    expect(RAW_LC).toContain("stop"); // human-resolve rule, no auto-cleanup
    expect(RAW_LC).toContain("rollback");
  });
});

describe("both pending migrations remain real + honest in source", () => {
  const SELECTED_PATH = join(process.cwd(), "supabase/migrations/20260802000000_foundry_practice_run_selected_path_v1.sql");

  it("selected_path migration is present and still additive + table-scoped", () => {
    expect(existsSync(SELECTED_PATH)).toBe(true);
    const sp = readFileSync(SELECTED_PATH, "utf8").toLowerCase().split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
    expect(sp).toContain("add column if not exists selected_path jsonb null");
    expect(sp).toContain("public.foundry_arena_practice_runs");
    expect(sp).not.toContain("create index");
    expect(sp).not.toContain("create policy");
    expect(sp).not.toContain("drop ");
  });

  it("neither migration is stubbed/emptied (both carry their real DDL)", () => {
    expect(existsSync(PATH)).toBe(true);
    expect(RAW_LC).toContain("create unique index");
  });
});
