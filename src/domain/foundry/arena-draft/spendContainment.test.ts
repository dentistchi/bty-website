import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERATION_OUTCOMES, classifyGenerationOutcome, retriabilityOf } from "./generationOutcome";
import { resolveAttribution } from "./generationAttribution";

/**
 * SPEND CONTAINMENT CONTRACTS (Slice 3.2I-R5B2-R5C-6A).
 *
 * The live controlled run recorded `terminal_stage: semantic_review` beside
 * `outcome: boundary_review_rejected` — a semantic failure filed under a boundary umbrella. These
 * tests hold the repair, and hold the system-block vocabulary against the migration text so the
 * SQL and the product cannot drift.
 */

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805050000_foundry_practice_generation_spend_containment_v1.sql"),
  "utf8",
);
/** The migration with comment lines stripped — what the database will actually run. */
const EXECUTABLE = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("[R5C-6A] a terminal reviewer failure is an EXECUTION failure, not a refusal", () => {
  it("the semantic reviewer's reason no longer maps to the boundary umbrella", () => {
    // THE measured defect: `reviewer_terminal_failure` is the SEMANTIC reviewer's reason, and
    // attribution has always filed it under `semantic_review`.
    expect(classifyGenerationOutcome("reviewer_terminal_failure")).toBe("review_execution_failed");
    expect(classifyGenerationOutcome("reviewer_terminal_failure")).not.toBe("boundary_review_rejected");
  });

  it("both reviewers' terminal failures share one honest umbrella", () => {
    expect(classifyGenerationOutcome("boundary_reviewer_terminal_failure")).toBe("review_execution_failed");
  });

  it("the outcome and the exact attribution now AGREE about the stage", () => {
    const attribution = resolveAttribution({ reason: "reviewer_terminal_failure" });
    expect(attribution.terminalStage).toBe("semantic_review");
    expect(attribution.terminalReasonCode).toBe("semantic_reviewer_terminal_failure");
    // The contradiction the live rows carry is now impossible in new records.
    expect(classifyGenerationOutcome("reviewer_terminal_failure")).toBe("review_execution_failed");
  });

  it("a boundary REFUSAL is still a refusal — the umbrella did not swallow it", () => {
    expect(classifyGenerationOutcome("boundary_review_rejected")).toBe("boundary_review_rejected");
    expect(classifyGenerationOutcome("generation_rejected")).toBe("scenario_quality_rejected");
    expect(classifyGenerationOutcome("no_safe_judgment_space")).toBe("scenario_quality_rejected");
  });

  it("matching is EXACT, never by prefix — the prefix rule is what caused the defect", () => {
    // `reviewer_terminal_failure` shares no prefix with `boundary_review*`; it was an explicit OR
    // clause. Anything not named falls through to the internal gap rather than being guessed.
    expect(classifyGenerationOutcome("reviewer_terminal_failure_v2")).toBe("internal_failure");
  });

  it("the new outcome joins the vocabulary, and its retriability is honest", () => {
    expect(GENERATION_OUTCOMES).toContain("review_execution_failed");
    // MEASURED at one success in seven semantic-review calls. `false` would be a false promise;
    // `true` would invite a spend that usually fails. The system block, not this field, is what
    // actually stops the repetition.
    expect(retriabilityOf("review_execution_failed")).toBe("unknown");
  });
});

describe("[R5C-6A] the SQL system-block vocabulary matches the product's", () => {
  it("names exactly the two source-proven terminal execution failures", () => {
    const body = SQL.slice(
      SQL.indexOf("create or replace function public.foundry_practice_generation_is_system_block_v1"),
      SQL.indexOf("comment on function public.foundry_practice_generation_is_system_block_v1"),
    );
    const quoted = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(quoted.length, "parsed nothing — the assertions below would be vacuous").toBeGreaterThan(0);
    expect([...quoted].sort()).toEqual(
      ["boundary_reviewer_terminal_failure", "review_execution_failed", "semantic_reviewer_terminal_failure"].sort(),
    );
  });

  it("does NOT include any content refusal, inconclusive verdict or transient fault", () => {
    const body = SQL.slice(
      SQL.indexOf("is_system_block_v1"),
      SQL.indexOf("comment on function public.foundry_practice_generation_is_system_block_v1"),
    );
    for (const excluded of [
      "scenario_quality_rejected",
      "semantic_content_rejected",
      "boundary_content_rejected",
      "semantic_review_inconclusive",
      "boundary_review_inconclusive",
      "provider_timeout",
      "scenario_persistence_failed",
      "internal_unclassified_failure",
    ]) {
      expect(body, `${excluded} must not be a system block`).not.toContain(`'${excluded}'`);
    }
  });

  it("the block outranks the setup states but not an active attempt", () => {
    // Precedence is the contract: a Host cannot fix an evaluator by editing their answers, but a
    // run already in flight is still the more urgent truth.
    const order = ["'in_progress'", "'system_blocked'", "'revision_required'", "'confirm_second_attempt'"];
    const govBody = SQL.slice(SQL.indexOf("when v_active then 'in_progress'"));
    let cursor = -1;
    for (const token of order) {
      const at = govBody.indexOf(token);
      expect(at, `${token} missing from the precedence chain`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("a system block does NOT recommend reviewing the setup", () => {
    // Sending a Host to rewrite answers that were never the problem would be untrue.
    expect(SQL).toContain("not v_system_blocked and v_count >= 1");
  });

  it("the migration mutates no historical row", () => {
    expect(EXECUTABLE).not.toMatch(/\bupdate\s+public\./i);
    expect(EXECUTABLE).not.toMatch(/\bdelete\s+from\s+public\./i);
  });

  it("admission cannot be reached without a submission intent", () => {
    expect(SQL).toContain("missing_submission_intent");
  });

  /**
   * EXPAND/CONTRACT (Part 0B). This file holds the EXPAND half. The two statements that
   * break the PREVIOUSLY deployed 15-argument Worker — dropping the old overload, and the
   * NOT VALID contradiction constraint — deliberately live in the CONTRACT migration, which
   * runs only after a 16-argument caller is live. Asserting their ABSENCE here is what stops
   * them silently drifting back into the migration that has to run first.
   *
   * Note the assertions read EXECUTABLE, not SQL: the migration's rollback block mentions
   * both statements in comments, and matching raw text would pass on a comment alone.
   */
  it("the expand half breaks no previously deployed caller", () => {
    expect(EXECUTABLE).not.toMatch(/drop function if exists public\.start_foundry_practice_generation_attempt_governed_v1\(/);
    expect(EXECUTABLE).not.toContain("foundry_practice_gen_attempt_review_exec_chk");
    expect(EXECUTABLE).not.toContain("not valid");
    // …while still CREATING the 16-argument overload the next deployment needs.
    expect(EXECUTABLE).toMatch(/create or replace function public\.start_foundry_practice_generation_attempt_governed_v1\(/);
    expect(EXECUTABLE).toContain("p_submission_intent_id");
  });

  it("idempotency is enforced by the DATABASE, not only by the function body", () => {
    expect(SQL).toContain("foundry_practice_gen_attempt_intent_uniq");
    expect(SQL).toContain("where submission_intent_id is not null");
    // A concurrent duplicate that beats the in-function check is still caught.
    expect(SQL).toContain("when unique_violation then");
  });
});
