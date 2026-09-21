import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260920210152_clinical_encounter_attempt_lifecycle.sql"), "utf8");

it("keeps the unapplied attempt lifecycle migration additive and locks superseded learner rows", () => {
  expect(migration).not.toMatch(/\bdrop\b/i);
  expect(migration).toContain("add column if not exists superseded_at timestamptz");
  expect(migration).toContain("add column if not exists superseded_by_trace_id text");
  expect(migration).toContain("create index if not exists clinical_reasoning_traces_user_case_current_active_idx");
  expect(migration).toContain("alter policy \"clinical_reasoning_traces_update_own_active_learner\"");
  expect(migration.match(/superseded_at is null/g)).toHaveLength(3);
});
