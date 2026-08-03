import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SETUP_SENSITIVE_LEGACY_OUTCOMES,
  SETUP_SENSITIVE_REASON_CODES,
  refusalCountsForGovernance,
} from "./generationInputRevision";
import { TERMINAL_REASON_CODES } from "./generationAttribution";

/**
 * ONE SOURCE OF TRUTH (Slice 3.2I-R5B2-R5C-4A2 Part 5).
 *
 * The database owns the refusal vocabulary: both the read-only governance function and the atomic
 * admission function call the SQL classifier, and no application code re-derives the decision. The
 * TypeScript copy exists only so unit doubles can model admission without a database.
 *
 * Two independently maintained lists would drift, and the drift would be invisible until a Host
 * was blocked (or not blocked) for the wrong reason. This test reads the MIGRATION TEXT and fails
 * the moment the two disagree.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805040000_foundry_practice_generation_retry_governance_v1.sql"),
  "utf8",
);

/** The two literal lists inside the classifier body, read from the migration itself. */
function sqlListsFromClassifier() {
  const body = SQL.slice(
    SQL.indexOf("create or replace function public.foundry_practice_generation_refusal_counts_v1"),
    SQL.indexOf("comment on function public.foundry_practice_generation_refusal_counts_v1"),
  );
  const exact = body.slice(body.indexOf("p_terminal_reason_code in ("), body.indexOf("-- LEGACY"));
  const legacy = body.slice(body.indexOf("coalesce(p_outcome, '') in ("));
  const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  return { exact: quoted(exact), legacy: quoted(legacy) };
}

describe("[R5C-4A2] the TypeScript mirror matches the SQL classifier exactly", () => {
  it("read the migration and found both lists", () => {
    const { exact, legacy } = sqlListsFromClassifier();
    // A parse that silently found nothing would make every assertion below vacuous.
    expect(exact.length).toBeGreaterThan(0);
    expect(legacy.length).toBeGreaterThan(0);
  });

  it("the exact-attribution list is identical, in both directions", () => {
    const { exact } = sqlListsFromClassifier();
    expect([...exact].sort()).toEqual([...SETUP_SENSITIVE_REASON_CODES].sort());
  });

  it("the legacy-outcome list is identical, in both directions", () => {
    const { legacy } = sqlListsFromClassifier();
    expect([...legacy].sort()).toEqual([...SETUP_SENSITIVE_LEGACY_OUTCOMES].sort());
  });
});

describe("[R5C-4A2] the classification is exhaustive over the CURRENT vocabulary", () => {
  it("every terminal reason code is deliberately classified", () => {
    // Not a spot-check: the whole vocabulary is enumerated, so a newly added code cannot slip in
    // unclassified and land on a default.
    for (const code of TERMINAL_REASON_CODES) {
      expect(typeof refusalCountsForGovernance("scenario_quality_rejected", code), code).toBe("boolean");
    }
    const counted = TERMINAL_REASON_CODES.filter((c) => refusalCountsForGovernance("scenario_quality_rejected", c));
    expect([...counted].sort()).toEqual([...SETUP_SENSITIVE_REASON_CODES].sort());
  });

  it("infrastructure and execution failures never count", () => {
    for (const code of [
      "provider_timeout",
      "provider_transport_error",
      "provider_http_error",
      "provider_empty_output",
      "provider_malformed_output",
      "provider_schema_invalid",
      "semantic_reviewer_transport_failure",
      "semantic_reviewer_schema_failure",
      "boundary_reviewer_transport_failure",
      "boundary_reviewer_schema_failure",
      "scenario_persistence_failed",
      "internal_unclassified_failure",
      "generation_observability_unavailable",
      "generation_not_eligible",
      // Source-proven: "the scenario was never successfully judged at all".
      "semantic_reviewer_terminal_failure",
      "boundary_reviewer_terminal_failure",
      // Source-proven: raised BEFORE the request is built and before any provider call.
      "semantic_review_authority_failure",
      "boundary_review_authority_failure",
    ]) {
      expect(refusalCountsForGovernance("scenario_quality_rejected", code), code).toBe(false);
    }
  });

  it("an exact reason OVERRIDES the broad outcome", () => {
    expect(refusalCountsForGovernance("scenario_quality_rejected", "provider_timeout")).toBe(false);
    expect(refusalCountsForGovernance("provider_timeout", "scenario_quality_rejected")).toBe(true);
  });

  it("legacy rows fall back to the outcome only when no reason exists", () => {
    expect(refusalCountsForGovernance("scenario_quality_rejected", null)).toBe(true);
    expect(refusalCountsForGovernance("boundary_review_rejected", null)).toBe(true);
    expect(refusalCountsForGovernance("provider_timeout", null)).toBe(false);
    expect(refusalCountsForGovernance("success", null)).toBe(false);
    expect(refusalCountsForGovernance(null, null)).toBe(false);
  });
});
