import { describe, it, expect } from "vitest";
import {
  GATE_LEVELS,
  classifyCode,
  isRegisteredCode,
  isTerminalOutcome,
  registeredCodes,
  resolveRejection,
  retryableFindings,
  type Finding,
} from "./gatePrecedence";

/**
 * GATE PRECEDENCE (Slice 3.2I-R5B1A.1-R2.23).
 *
 * Two measured facts drove this. c01's lying option was reported as `construction_contradicts_label`
 * and never as `false_reassurance`, because the construction gate runs first. c09's repeated branch
 * choice was reported as `provider_low_quality` and never as
 * `repeated_choice_meaning_within_branch`, for the same reason. Both codes were true in both cases;
 * one survived, and the retry saw one defect out of several.
 *
 * Precedence must therefore be a property of the FINDING SET, not of execution order.
 */

const f = (code: string, gate = "g", over: Partial<Finding> = {}): Finding => ({ code, gate, ...over });

describe("code classification", () => {
  it("places every registered code in a documented level", () => {
    for (const code of registeredCodes()) {
      const c = classifyCode(code);
      expect(GATE_LEVELS[c.level], code).toBeDefined();
      expect(c.level).toBeLessThanOrEqual(7);
    }
  });

  it("2. a hard boundary defect outranks vague reassurance", () => {
    expect(classifyCode("confirmed_boundary_absent").level).toBe(3);
    expect(classifyCode("vague_reassurance").level).toBe(5);
    expect(classifyCode("confirmed_boundary_absent").level).toBeLessThan(classifyCode("vague_reassurance").level);
  });

  it("3. an unsafe delay outranks an ordinary dominated-choice defect", () => {
    expect(classifyCode("unsafe_delay").level).toBe(3);
    expect(classifyCode("dominated_choice").level).toBe(4);
  });

  it("terminal codes are exactly the ones a retry cannot change", () => {
    for (const c of ["generation_unavailable", "structured_output_unavailable", "provider_refusal", "unresolved_boundary_requires_confirmation", "all_options_violate_confirmed_boundary", "prohibited_choice_only"]) {
      expect(classifyCode(c).terminal, c).toBe(true);
    }
    for (const c of ["confirmed_boundary_absent", "vague_reassurance", "dominated_choice", "cross_branch_axis_collapse", "review_contradictory"]) {
      expect(classifyCode(c).terminal, c).toBe(false);
    }
  });

  it("an unknown code is surfaced at level 8, never assumed harmless", () => {
    expect(isRegisteredCode("something_nobody_classified")).toBe(false);
    expect(classifyCode("something_nobody_classified").level).toBe(8);
    // …but a prefixed family still lands in its family's level.
    expect(classifyCode("review_some_new_gate").level).toBe(7);
    expect(classifyCode("dto_some_new_shape").level).toBe(2);
  });
});

describe("primary code selection", () => {
  it("1. a transport failure outranks every content defect", () => {
    const r = resolveRejection([f("vague_reassurance"), f("cross_branch_axis_collapse"), f("truncated_output"), f("dominated_choice")])!;
    expect(r.primaryCode).toBe("truncated_output");
    expect(r.primaryLevel).toBe(1);
  });

  it("2. THE MEASURED c01 CASE — a boundary defect is no longer hidden behind a construction defect", () => {
    const r = resolveRejection([f("construction_contradicts_label", "choice_construction"), f("confirmed_boundary_absent", "boundary_grounding")])!;
    expect(r.primaryCode).toBe("confirmed_boundary_absent");
    // …and the construction finding is NOT lost, which was the actual defect in R2.22.
    expect(r.defectCodes).toEqual(["confirmed_boundary_absent", "construction_contradicts_label"]);
  });

  it("3. an unsafe delay outranks a dominated choice in a mixed set", () => {
    expect(resolveRejection([f("dominated_choice"), f("unsafe_delay")])!.primaryCode).toBe("unsafe_delay");
  });

  it("5/6. the primary code is a function of the SET — shuffling the input cannot change it", () => {
    const codes = ["vague_reassurance", "confirmed_boundary_absent", "dominated_choice", "cross_branch_axis_collapse", "review_contradictory", "unsafe_delay"];
    const base = resolveRejection(codes.map((c) => f(c)))!;
    // Every rotation of the same set must resolve identically.
    for (let i = 0; i < codes.length; i++) {
      const rotated = [...codes.slice(i), ...codes.slice(0, i)].map((c) => f(c));
      const r = resolveRejection(rotated)!;
      expect(r.primaryCode).toBe(base.primaryCode);
      expect(r.defectCodes).toEqual(base.defectCodes);
    }
    // …and reversed, and sorted.
    expect(resolveRejection([...codes].reverse().map((c) => f(c)))!.defectCodes).toEqual(base.defectCodes);
    expect(resolveRejection([...codes].sort().map((c) => f(c)))!.defectCodes).toEqual(base.defectCodes);
  });

  it("6b. two codes at one level resolve by registry rank, not by name or arrival", () => {
    const a = resolveRejection([f("vague_reassurance"), f("bad_faith_option")])!;
    const b = resolveRejection([f("bad_faith_option"), f("vague_reassurance")])!;
    expect(a.primaryCode).toBe(b.primaryCode);
    expect(a.primaryCode).toBe("bad_faith_option"); // declared earlier at level 5
  });

  it("4. multiple quality defects are aggregated, ordered by precedence", () => {
    const r = resolveRejection([
      f("cross_branch_axis_collapse", "branch_review"),
      f("vague_reassurance", "phase_choice_review"),
      f("no_real_cost", "choice_construction"),
      f("confirmed_boundary_absent", "boundary_grounding"),
    ])!;
    expect(r.defectCodes).toEqual(["confirmed_boundary_absent", "no_real_cost", "vague_reassurance", "cross_branch_axis_collapse"]);
    expect(r.findings.map((x) => x.level)).toEqual([3, 4, 5, 6]);
  });

  it("an empty finding set is not a rejection", () => {
    expect(resolveRejection([])).toBeNull();
  });
});

describe("deduplication and evidence", () => {
  it("7. the same code from two gates collapses to one finding, and BOTH gates are retained", () => {
    const r = resolveRejection([f("vague_reassurance", "measured_labels"), f("vague_reassurance", "phase_choice_review")])!;
    expect(r.findings).toHaveLength(1);
    expect(r.defectCodes).toEqual(["vague_reassurance"]);
    expect(r.evidenceSources.vague_reassurance).toEqual(["measured_labels", "phase_choice_review"]);
  });

  it("7b. the same code at DIFFERENT coordinates stays as separate findings", () => {
    const r = resolveRejection([
      f("vague_reassurance", "g", { phase: "branch_action", branchIndex: 0, choiceIndex: 1 }),
      f("vague_reassurance", "g", { phase: "branch_action", branchIndex: 1, choiceIndex: 1 }),
    ])!;
    expect(r.findings).toHaveLength(2);
    expect(r.defectCodes).toEqual(["vague_reassurance"]); // one code, two places
  });

  it("7c. a code reported once has no evidence-source entry — the map records genuine overlap only", () => {
    expect(resolveRejection([f("vague_reassurance", "one")])!.evidenceSources).toEqual({});
  });
});

describe("terminal versus retryable", () => {
  it("9. terminal findings never enter the retryable set", () => {
    const r = resolveRejection([f("structured_output_unavailable"), f("vague_reassurance")])!;
    expect(r.primaryCode).toBe("structured_output_unavailable");
    expect(r.terminal).toBe(true);
    expect(retryableFindings(r).map((x) => x.code)).toEqual(["vague_reassurance"]);
  });

  it("9b. a set of only terminal findings is a terminal outcome", () => {
    expect(isTerminalOutcome(resolveRejection([f("all_options_violate_confirmed_boundary")])!)).toBe(true);
  });

  it("9c. a correctable set is not terminal", () => {
    expect(isTerminalOutcome(resolveRejection([f("vague_reassurance"), f("dominated_choice")])!)).toBe(false);
  });

  it("10. a semantic-review transport failure is reviewer-contract integrity, not a content defect", () => {
    // Regenerating a different scenario cannot fix a reviewer that failed to answer. The code sits
    // at Level 7 and is classified as a review-contract failure, so it is never reported as though
    // the generated content were at fault.
    expect(classifyCode("review_truncated").level).toBe(7);
    expect(classifyCode("review_not_json").level).toBe(7);
    const r = resolveRejection([f("review_truncated", "semantic_review")])!;
    expect(r.primaryLevel).toBe(7);
    expect(r.primaryCode).toBe("review_truncated");
  });
});
