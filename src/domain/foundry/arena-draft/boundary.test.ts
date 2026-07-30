import { describe, it, expect } from "vitest";
import { validateBoundary, suggestConstraints, validateConstraintAssessments, constraintId } from "./boundary";
import type { ArenaScenarioDraft } from "./types";

describe("validateBoundary", () => {
  const c = (id: string, statement: string) => ({ id, statement, provenance: "manager_entered" as const });

  it("accepts a confirmed judgment_with_constraints boundary", () => {
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [c("c1", "Verify identity before treatment")] }).ok).toBe(true);
  });
  it("accepts knowledge_check / judgment with no constraints", () => {
    expect(validateBoundary({ mode: "knowledge_check", confirmed: true, constraints: [] }).ok).toBe(true);
    expect(validateBoundary({ mode: "judgment", confirmed: true, constraints: [] }).ok).toBe(true);
  });
  it("requires >=1 constraint for judgment_with_constraints", () => {
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [] }).errors).toContain("boundary_constraints_required");
  });
  it("rejects invalid mode / non-boolean confirmed", () => {
    expect(validateBoundary({ mode: "nope", confirmed: "yes", constraints: [] }).ok).toBe(false);
  });
  it("rejects empty / duplicate / oversized statements and duplicate ids", () => {
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [c("c1", "  ")] }).errors).toContain("constraint_statement_empty");
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [c("c1", "A rule"), c("c2", "a rule")] }).errors).toContain("constraint_duplicate_statement");
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [c("c1", "R1"), c("c1", "R2")] }).errors).toContain("constraint_duplicate_id");
    expect(validateBoundary({ mode: "judgment_with_constraints", confirmed: true, constraints: [c("c1", "x".repeat(400))] }).errors).toContain("constraint_statement_too_long");
  });
  it("rejects an invalid provenance", () => {
    expect(validateBoundary({ mode: "judgment", confirmed: true, constraints: [{ id: "c1", statement: "R", provenance: "made_up" }] }).errors).toContain("constraint_provenance_invalid");
  });
});

describe("suggestConstraints — provenance-labeled, from authorized facts only", () => {
  it("suggests a rule from the problem with provenance", () => {
    const s = suggestConstraints({ problem: "Two identifiers must be verified before treatment. It is stressful.", learningNeeds: ["decide"] });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].provenance).toBe("suggested_from_problem");
    expect(s[0].statement).toMatch(/identifiers must be verified/i);
    expect(s[0].id).toBe(constraintId(0, s[0].statement));
  });
  it("returns nothing when there is no mandate", () => {
    expect(suggestConstraints({ problem: "A teammate disagrees on the approach", learningNeeds: ["decide"] })).toEqual([]);
  });
});

function draft(): ArenaScenarioDraft {
  return {
    title: "t", opening: "o",
    primary: { choices: [{ id: "primary_1", label: "A" }, { id: "primary_2", label: "B" }] },
    tradeoff: { escalationText: "e", choices: [{ id: "t1", label: "x" }, { id: "t2", label: "y" }] },
    actionDecision: { prompt: "p", choices: [{ id: "a1", label: "x", isActionCommitment: true }, { id: "a2", label: "y", isActionCommitment: false }] },
  };
}
const A = (ids: string[]) => ids.map((constraintId) => ({ constraintId, status: "satisfied", rationale: "ok" }));

describe("validateConstraintAssessments", () => {
  it("passes when every choice covers every constraint id", () => {
    const d = draft();
    const map = { primary_1: A(["c1"]), primary_2: A(["c1"]), t1: A(["c1"]), t2: A(["c1"]), a1: A(["c1"]), a2: A(["c1"]) };
    expect(validateConstraintAssessments(d, ["c1"], map).ok).toBe(true);
  });
  it("no constraints → trivially ok", () => {
    expect(validateConstraintAssessments(draft(), [], undefined).ok).toBe(true);
  });
  it("rejects a missing assessment for a choice", () => {
    const map = { primary_1: A(["c1"]) }; // others missing
    expect(validateConstraintAssessments(draft(), ["c1"], map).errors).toContain("assessment_missing_for_choice");
  });
  it("rejects an unknown constraint id and an uncovered constraint", () => {
    const d = draft();
    const bad = { primary_1: A(["ghost"]), primary_2: A(["c1"]), t1: A(["c1"]), t2: A(["c1"]), a1: A(["c1"]), a2: A(["c1"]) };
    const r = validateConstraintAssessments(d, ["c1"], bad);
    expect(r.errors).toContain("assessment_unknown_constraint");
    expect(r.errors).toContain("assessment_constraint_uncovered");
  });
  it("rejects a non-satisfied status", () => {
    const d = draft();
    const map: Record<string, unknown> = { primary_1: [{ constraintId: "c1", status: "violated", rationale: "x" }], primary_2: A(["c1"]), t1: A(["c1"]), t2: A(["c1"]), a1: A(["c1"]), a2: A(["c1"]) };
    expect(validateConstraintAssessments(d, ["c1"], map).errors).toContain("assessment_not_satisfied");
  });
  it("rejects a malformed (non-object) assessments payload", () => {
    expect(validateConstraintAssessments(draft(), ["c1"], "nope").errors).toContain("assessment_missing");
  });
});
