import { describe, it, expect } from "vitest";
import {
  DIAGNOSTIC_CODE_RE,
  MAX_DIAGNOSTIC_CODES,
  boundaryDiagnosticCodes,
  generationDiagnosticCodes,
  interleaveDiagnosticCodes,
} from "./generationDiagnosticCodes";

describe("[diagnostic codes] stage prefixes and bounds", () => {
  it("D1 every stage is named by its prefix", () => {
    expect(
      boundaryDiagnosticCodes({
        calls: [
          { attempt: 1, kind: "review", codes: ["boundary_candidate_wrong_role"] },
          { attempt: 2, kind: "repair", codes: ["boundary_review_invalid_result"] },
        ],
        repairPlanUnavailable: null,
        repairCodes: ["field_repair_operation_missing"],
      }),
    ).toEqual(["r1_boundary_candidate_wrong_role", "fr_field_repair_operation_missing", "fr_boundary_review_invalid_result"]);
  });

  it("D2 the production signature: first review refused, no plan (ambiguous rule target), second review refused", () => {
    expect(
      boundaryDiagnosticCodes({
        calls: [
          { attempt: 1, kind: "review", codes: ["boundary_candidate_wrong_role"] },
          { attempt: 2, kind: "review", codes: ["boundary_candidate_wrong_role"] },
        ],
        repairPlanUnavailable: "field_repair_ambiguous_rule_target",
      }),
    ).toEqual(["r1_boundary_candidate_wrong_role", "fp_field_repair_ambiguous_rule_target", "r2_boundary_candidate_wrong_role"]);
  });

  it("D3 never more than the column holds, and a noisy stage cannot crowd the others out", () => {
    const many = Array.from({ length: 20 }, (_, i) => `boundary_code_${i}`);
    const out = boundaryDiagnosticCodes({
      calls: [
        { attempt: 1, kind: "review", codes: many },
        { attempt: 2, kind: "review", codes: ["boundary_review_missing_pair"] },
      ],
      repairPlanUnavailable: "review_not_subset_repairable",
    });
    expect(out.length).toBe(MAX_DIAGNOSTIC_CODES);
    expect(out).toContain("fp_review_not_subset_repairable");
    expect(out).toContain("r2_boundary_review_missing_pair");
  });

  it("D4 only identifiers survive — prose, empty and over-long values are dropped, duplicates collapse", () => {
    const out = generationDiagnosticCodes(["confirmed_boundary_absent", "the reviewer wrote a sentence", "", "x".repeat(70), "confirmed_boundary_absent"]);
    expect(out).toEqual(["g_confirmed_boundary_absent"]);
    for (const c of out) expect(c).toMatch(DIAGNOSTIC_CODE_RE);
  });

  it("D5 nothing to say → nothing written", () => {
    expect(boundaryDiagnosticCodes({ calls: [] })).toEqual([]);
    expect(generationDiagnosticCodes(undefined)).toEqual([]);
    expect(interleaveDiagnosticCodes([[], []])).toEqual([]);
  });
});
