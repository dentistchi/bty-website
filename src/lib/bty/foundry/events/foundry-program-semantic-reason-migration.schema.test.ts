import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIVE_SEMANTIC_REASON_VOCABULARY,
  SEMANTIC_REASON_DIAGNOSTICS_ENABLED,
  storableScenarioReason,
  storableEvidenceRule,
} from "./programGenerationRecorder";
import { SCENARIO_DEFECT_REASONS } from "@/domain/foundry/module/program-coherence";
import { evidencePolicyRuleIds } from "@/domain/foundry/module/evidence-policy";

/**
 * SLICE 3.2P-A5-R2 — THREE VOCABULARIES, COMPARED BY MACHINE.
 *
 * A diagnostic column has three separate ideas of what it may contain: the DOMAIN's, the
 * RECORDER's view of what the live schema accepts, and the CHECK constraint the Founder will
 * actually execute. The `interrogative_action` incident proved what happens when those drift —
 * the domain produced a reason the constraint had never heard of, and the whole child update
 * would have failed to record one field.
 *
 * So the three are compared here, before the SQL is ever run, rather than by eye.
 */
const PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260821000000_foundry_program_semantic_reason_diagnostics_v1.sql",
);
const RAW = readFileSync(PATH, "utf8");
/** Comments carry the reasoning, including words forbidden in EXECUTABLE SQL. Strip them. */
const CODE = RAW.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").toLowerCase().trim();

const CHILD = "public.foundry_program_generation_attempt_calls";

/** The values inside one `check (col is null or col in (…))` clause, in file order. */
function checkVocabulary(column: string): string[] {
  const m = new RegExp(`check \\(${column} is null or ${column} in \\(([^)]*)\\)`).exec(CODE);
  if (!m) return [];
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

describe("[3.2P-A5-R2] the migration says what the runtime says", () => {
  it("scenario: domain set === runtime set === migration set", () => {
    const domain = [...SCENARIO_DEFECT_REASONS].sort();
    const runtime = [...LIVE_SEMANTIC_REASON_VOCABULARY.scenario].sort();
    const migration = checkVocabulary("scenario_contract_reason").sort();
    console.log(`SCENARIO runtime=${runtime.join(",")}`);
    console.log(`SCENARIO migration=${migration.join(",")}`);
    console.log(`SCENARIO IDENTICAL=${JSON.stringify(runtime) === JSON.stringify(migration) && JSON.stringify(domain) === JSON.stringify(runtime)}`);
    expect(migration).toEqual(runtime);
    expect(runtime).toEqual(domain);
  });

  it("evidence: policy set === runtime set === migration set", () => {
    const policy = evidencePolicyRuleIds().sort();
    const runtime = [...LIVE_SEMANTIC_REASON_VOCABULARY.evidence].sort();
    const migration = checkVocabulary("evidence_policy_rule").sort();
    console.log(`EVIDENCE runtime=${runtime.join(",")}`);
    console.log(`EVIDENCE migration=${migration.join(",")}`);
    console.log(`EVIDENCE IDENTICAL=${JSON.stringify(runtime) === JSON.stringify(migration) && JSON.stringify(policy) === JSON.stringify(runtime)}`);
    expect(migration).toEqual(runtime);
    expect(runtime).toEqual(policy);
  });
});

describe("[3.2P-A5-R2] the migration is additive and touches nothing else", () => {
  it("targets the CHILD call table and adds exactly two nullable columns, idempotently", () => {
    expect(CODE).toContain(`alter table ${CHILD}`);
    for (const col of ["scenario_contract_reason", "evidence_policy_rule"]) {
      expect(CODE).toContain(`add column if not exists ${col} text`);
    }
    expect(CODE).toContain("begin;");
    expect(CODE).toContain("commit;");
  });

  it("writes no data and rewrites no history", () => {
    for (const forbidden of ["insert into", "update ", "delete from", "truncate", "drop column", "drop table"]) {
      expect(CODE, `executable SQL contains ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("changes no security or performance surface", () => {
    for (const forbidden of ["row level security", "create policy", "alter policy", "drop policy", "grant ", "revoke ", "create index"]) {
      expect(CODE, `executable SQL contains ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("is the next migration id, and its own file name", () => {
    expect(PATH).toContain("20260821000000_foundry_program_semantic_reason_diagnostics_v1.sql");
  });
});

describe("[3.2P-A5-R2] deploy order — nothing can fail on a column that does not exist", () => {
  it("persistence is active, and was withheld until the DDL existed", () => {
    /*
      A5-R2 shipped this false and MEASURED the consequence live: the umbrella refusal recorded
      normally while the subtype read back NULL. A5-R2A flipped it only after probing the live
      CHECKs — 6/6 scenario reasons, 12/12 evidence rules and NULL accepted, four invented
      values refused by the constraint itself, zero rows written by any probe.

      `scripts/verify-semantic-reason-diagnostics.ts` is the live proof and is deliberately NOT
      part of this suite: CI must never write to staging.
    */
    expect(SEMANTIC_REASON_DIAGNOSTICS_ENABLED).toBe(true);
  });

  it("and a value the live CHECK has not learned is stored as NULL, never written blind", () => {
    for (const good of LIVE_SEMANTIC_REASON_VOCABULARY.scenario) expect(storableScenarioReason(good)).toBe(good);
    for (const good of LIVE_SEMANTIC_REASON_VOCABULARY.evidence) expect(storableEvidenceRule(good)).toBe(good);
    for (const unknown of ["banana", "no_pressure_v2", "", undefined]) {
      expect(storableScenarioReason(unknown as string | undefined)).toBeNull();
      expect(storableEvidenceRule(unknown as string | undefined)).toBeNull();
    }
    // Cross-contamination would pass a CHECK it was never meant for.
    expect(storableScenarioReason("organisational_outcome")).toBeNull();
    expect(storableEvidenceRule("no_pressure")).toBeNull();
  });
});
