import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOUNDARY_REVIEW_DIAGNOSTIC_CODES,
  BOUNDARY_REVIEW_DIAGNOSTIC_CONTRACT_VERSION,
} from "@/domain/foundry/arena-draft/boundaryReviewDiagnostics";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260924161342_practice_generation_reviewer_diagnostics_v1.sql"),
  "utf8",
);

describe("practice reviewer diagnostics migration", () => {
  it("is additive, idempotent, and does not alter historical attempts", () => {
    expect(SQL).toContain("add column if not exists terminal_diagnostic_code");
    expect(SQL).toContain("add column if not exists support_reference");
    expect(SQL).not.toMatch(/\b(update|delete|insert)\s+public\./i);
    expect(SQL).not.toMatch(/\bdrop\s+(table|column|constraint)/i);
    expect(SQL).not.toMatch(/create\s+(or replace\s+)?trigger/i);
  });

  it("stores only the closed non-content diagnostic vocabulary", () => {
    for (const code of BOUNDARY_REVIEW_DIAGNOSTIC_CODES) expect(SQL).toContain(`'${code}'`);
    expect(SQL).toContain(`terminal_diagnostic_contract_version = ${BOUNDARY_REVIEW_DIAGNOSTIC_CONTRACT_VERSION}`);
    expect(SQL).toContain("terminal_diagnostic_stage in ('boundary_review', 'boundary_repair')");
    expect(SQL).not.toMatch(/prompt_text|response_text|scenario_text|stack_trace|error_message/i);
  });

  it("retains the established private attempt-table posture", () => {
    expect(SQL).not.toMatch(/create policy|grant\s+/i);
    expect(SQL).toContain("Existing RLS and client privilege posture are intentionally unchanged");
  });
});
