/**
 * EXACT REFUSAL ATTRIBUTION (Slice 3.2I-R5B2-R5C-1).
 *
 * R5B's two real attempt rows are the specification here. One was recorded as
 * `boundary_review_rejected` when it may have been a semantic-reviewer failure or an authority
 * failure; the other as `scenario_quality_rejected` when a boundary CONTENT rejection produces the
 * identical service reason. These tests pin both halves of the fix.
 */

import { describe, it, expect } from "vitest";
import {
  ATTRIBUTION_VERSION,
  MAX_FINDING_CODES,
  REFUSAL_GATES,
  TERMINAL_REASON_CODES,
  TERMINAL_STAGES,
  resolveAttribution,
  sanitizeFindingCodes,
} from "./generationAttribution";

/**
 * Every terminal reason the production generation path can hand to the recorder, measured from
 * source. A reason absent from this inventory is a reason nobody attributed.
 */
const PRODUCTION_REASONS = [
  "generation_observability_unavailable",
  "generation_failed",
  "generation_rejected",
  "generation_unavailable",
  "structured_output_unavailable",
  "no_safe_judgment_space",
  "fixed_answer_knowledge",
  "safety_boundary_unresolved",
  "boundary_confirmation_required",
  "practice_boundary_scope_required",
  "too_many_active_boundaries",
  "unknown_active_boundary",
  "missing_required_active_boundary",
  "active_boundary_set_changed",
  "boundary_scope_not_confirmed",
  "boundary_review_inconclusive",
  "boundary_reviewer_terminal_failure",
  "boundary_review_authority_failure",
  "review_boundary_authority_failed",
  "reviewer_terminal_failure",
  "scenario_persistence_failed",
] as const;

describe("[R5C-1] every production reason resolves to exactly one stage/reason pair", () => {
  it.each(PRODUCTION_REASONS)("%s attributes to a closed-vocabulary pair", (reason) => {
    const a = resolveAttribution({ reason });
    expect(TERMINAL_STAGES).toContain(a.terminalStage);
    expect(TERMINAL_REASON_CODES).toContain(a.terminalReasonCode);
    expect(a.attributionVersion).toBe(ATTRIBUTION_VERSION);
  });

  it("resolution is deterministic — the same input never attributes two ways", () => {
    for (const r of PRODUCTION_REASONS) {
      const a = resolveAttribution({ reason: r });
      const b = resolveAttribution({ reason: r });
      expect(a).toEqual(b);
    }
  });
});

describe("[R5C-1] the boundary umbrella is gone", () => {
  it("a boundary CONTENT rejection is named — the case the reason alone could never carry", () => {
    // `boundaryStage.outcome === "boundary_review_reject"` exhausts its retry and returns plain
    // `generation_rejected`. Only the gate distinguishes it from a quality refusal.
    const a = resolveAttribution({ reason: "generation_rejected", gate: "narrow_boundary_review", primaryFindingCode: "boundary_reopened_after_prior_compliance" });
    expect(a.terminalStage).toBe("boundary_review");
    expect(a.terminalReasonCode).toBe("boundary_content_rejected");
    expect(a.refusalGate).toBe("narrow_boundary_review");
  });

  it.each([
    ["boundary_review_authority_failure", "boundary_review_authority_failure"],
    ["review_boundary_authority_failed", "boundary_review_authority_failure"],
    ["boundary_review_inconclusive", "boundary_review_inconclusive"],
    ["boundary_reviewer_terminal_failure", "boundary_reviewer_terminal_failure"],
  ])("%s stays distinct from a content rejection", (reason, expected) => {
    const a = resolveAttribution({ reason });
    expect(a.terminalStage).toBe("boundary_review");
    expect(a.terminalReasonCode).toBe(expected);
    expect(a.terminalReasonCode).not.toBe("boundary_content_rejected");
  });

  it("the four boundary non-content reasons remain four distinct codes", () => {
    const codes = new Set(
      ["boundary_review_authority_failure", "review_boundary_authority_failed", "boundary_review_inconclusive", "boundary_reviewer_terminal_failure"].map(
        (r) => resolveAttribution({ reason: r }).terminalReasonCode,
      ),
    );
    // Three, because the two authority spellings are one documented alias pair.
    expect(codes.size).toBe(3);
  });

  it("SEMANTIC reviewer failure is never filed under boundary review — R5B's exact mis-attribution", () => {
    const a = resolveAttribution({ reason: "reviewer_terminal_failure" });
    expect(a.terminalStage).toBe("semantic_review");
    expect(a.terminalReasonCode).toBe("semantic_reviewer_terminal_failure");
    expect(a.terminalStage).not.toBe("boundary_review");
  });

  it("a semantic CONTENT rejection is its own stage, not scenario_quality", () => {
    const a = resolveAttribution({ reason: "generation_rejected", gate: "semantic_review" });
    expect(a.terminalStage).toBe("semantic_review");
    expect(a.terminalReasonCode).toBe("semantic_content_rejected");
  });

  it("no prefix rule decides anything — a lookalike reason does not inherit a bucket", () => {
    for (const fake of ["boundary_review_something_new", "boundary_reviewer_wobble", "review_boundary_x"]) {
      const a = resolveAttribution({ reason: fake });
      expect(a.terminalStage).toBe("internal");
      expect(a.terminalReasonCode).toBe("internal_unclassified_failure");
    }
  });
});

describe("[R5C-1] the remaining stages are exact", () => {
  it("a quality-gate refusal stays scenario_quality", () => {
    for (const gate of ["provider_dto", "canonical_validator", undefined]) {
      const a = resolveAttribution({ reason: "generation_rejected", gate });
      expect(a.terminalStage).toBe("scenario_quality");
      expect(a.terminalReasonCode).toBe("scenario_quality_rejected");
    }
  });

  it("persistence failure maps to persistence", () => {
    const a = resolveAttribution({ reason: "scenario_persistence_failed" });
    expect(a.terminalStage).toBe("persistence");
    expect(a.terminalReasonCode).toBe("scenario_persistence_failed");
  });

  it("the observability gate is its own stage", () => {
    expect(resolveAttribution({ reason: "generation_observability_unavailable" }).terminalStage).toBe("observability_gate");
  });

  it("eligibility declines are not refusals of content", () => {
    for (const r of ["fixed_answer_knowledge", "boundary_confirmation_required", "too_many_active_boundaries"]) {
      const a = resolveAttribution({ reason: r });
      expect(a.terminalStage).toBe("generation_eligibility");
      expect(a.terminalReasonCode).toBe("generation_not_eligible");
    }
  });

  it("the R5A provider transport taxonomy is preserved unchanged", () => {
    expect(resolveAttribution({ reason: "provider_timeout" }).terminalReasonCode).toBe("provider_timeout");
    expect(resolveAttribution({ reason: "provider_transport_error" }).terminalStage).toBe("generation_provider");
    expect(resolveAttribution({ reason: "provider_malformed_output" }).terminalStage).toBe("generation_parse");
    expect(resolveAttribution({ reason: "structured_output_unavailable" }).terminalStage).toBe("generation_schema");
  });

  it("an unknown reason is VISIBLY unclassified, never the nearest plausible bucket", () => {
    const a = resolveAttribution({ reason: "something_nobody_measured" });
    expect(a.terminalStage).toBe("internal");
    expect(a.terminalReasonCode).toBe("internal_unclassified_failure");
  });
});

describe("[R5C-1] finding codes carry ranking and no prose", () => {
  it("preserves evaluator ranking and the headline code", () => {
    const a = resolveAttribution({
      reason: "generation_rejected",
      gate: "canonical_validator",
      primaryFindingCode: "moral_asymmetry",
      findingCodes: ["moral_asymmetry", "branch_incoherent_escalation", "hollow_throwaway"],
    });
    expect(a.primaryFindingCode).toBe("moral_asymmetry");
    expect(a.findingCodes).toEqual(["moral_asymmetry", "branch_incoherent_escalation", "hollow_throwaway"]);
    expect(a.findingCount).toBe(3);
  });

  it("is bounded, so one pathological response cannot grow a telemetry row", () => {
    const many = Array.from({ length: 30 }, (_, i) => `finding_code_${i}`);
    const a = resolveAttribution({ reason: "generation_rejected", findingCodes: many });
    expect(a.findingCodes).toHaveLength(MAX_FINDING_CODES);
    expect(a.findingCount).toBe(MAX_FINDING_CODES);
  });

  it("DISCARDS prose, excerpts and explanations rather than truncating them in", () => {
    const hostile = [
      "A teammate quietly flags a safety gap to you with the client's deadline hours away.",
      "Never disclose a patient identifier before consent is confirmed.",
      "The reviewer said the second option was too obviously wrong.",
      "Choice 2: Wait and see",
      "UPPERCASE_CODE",
      "has spaces",
      "x", // too short to be an identifier
      "valid_code_here",
    ];
    const a = resolveAttribution({ reason: "generation_rejected", findingCodes: hostile });
    expect(a.findingCodes).toEqual(["valid_code_here"]);
    for (const c of a.findingCodes) expect(c).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
    expect(JSON.stringify(a)).not.toMatch(/teammate|patient identifier|reviewer said|Choice 2/);
  });

  it("falls back to the first surviving ranked code when the headline is prose", () => {
    const a = resolveAttribution({
      reason: "generation_rejected",
      primaryFindingCode: "The scenario had no real tradeoff.",
      findingCodes: ["moral_asymmetry"],
    });
    expect(a.primaryFindingCode).toBe("moral_asymmetry");
  });

  it("keeps NULL rather than inventing a finding when no structured code exists", () => {
    const a = resolveAttribution({ reason: "boundary_review_inconclusive" });
    expect(a.primaryFindingCode).toBeNull();
    expect(a.findingCodes).toEqual([]);
    expect(a.findingCount).toBe(0);
  });

  it("deduplicates while preserving first-seen ranking", () => {
    expect(sanitizeFindingCodes(["a_code", "b_code", "a_code", "c_code"])).toEqual(["a_code", "b_code", "c_code"]);
  });

  it("an unrecognised gate is discarded, never stored as-is", () => {
    const a = resolveAttribution({ reason: "generation_rejected", gate: "some_new_gate" });
    expect(a.refusalGate).toBeNull();
    expect(REFUSAL_GATES).not.toContain("some_new_gate" as never);
  });
});
