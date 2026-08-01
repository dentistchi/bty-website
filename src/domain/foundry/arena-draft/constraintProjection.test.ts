import { describe, it, expect } from "vitest";
import { projectConstraintAssessments, type AcceptedBoundaryEvidence } from "./constraintProjection";
import { validateConstraintAssessments, type BoundaryConstraint } from "./boundary";
import { enumerateChoices } from "./choiceConstruction";
import { GEN_REVIEW_TEXT_MAX } from "./types";
import type { ArenaScenarioDraft } from "./types";

/**
 * REVIEW-DERIVED CONSTRAINT EVIDENCE (Slice 3.2I-R5B1A.1-R2.23C).
 *
 * The generator no longer certifies its own compliance. The same-shaped per-choice evidence is
 * materialized by the server from an ACCEPTED review — never before acceptance, never from the
 * generator's word, and never over a review that actually reported a problem.
 */

const rule = (n: number): BoundaryConstraint => ({ id: `c${n}_rule`, statement: `Rule ${n} must hold`, provenance: "manager_entered" });

const evidence = (n: number, over: Partial<AcceptedBoundaryEvidence> = {}): AcceptedBoundaryEvidence => ({
  boundaryId: `c${n}_rule`,
  presentInScenario: true,
  operationalized: true,
  allPrimaryChoicesComply: true,
  allTradeoffChoicesComply: true,
  allActionChoicesComply: true,
  allBranchesPreserve: true,
  violatedChoiceReferences: [],
  violatedBranchReferences: [],
  conciseExplanation: `Rule ${n} is established up front and holds on every path.`,
  ...over,
});

const draft: ArenaScenarioDraft = {
  title: "A backed-up ward",
  opening: "Two patients are waiting past their slot and the family is asking why.",
  primary: { choices: [{ id: "p1", label: "Verify both identifiers yourself" }, { id: "p2", label: "Bring in a second colleague" }] },
  tradeoff: { escalationText: "A fourth patient arrives.", choices: [{ id: "ft1", label: "Hold the staffing" }, { id: "ft2", label: "Reassign from the lounge" }] },
  actionDecision: { prompt: "What now?", choices: [{ id: "fa1", label: "Tell the family the delay", isActionCommitment: true }, { id: "fa2", label: "Wait for the charge nurse", isActionCommitment: false }] },
  branches: {
    p1: { escalationText: "You are mid-check when a second bay opens.", tradeoffChoices: [{ id: "p1-t1", label: "Finish the check first" }, { id: "p1-t2", label: "Hand over with a full brief" }], actionDecision: { prompt: "Commit?", choices: [{ id: "p1-a1", label: "Escalate the shortfall in writing", isActionCommitment: true }, { id: "p1-a2", label: "Raise it at handover", isActionCommitment: false }] } },
    p2: { escalationText: "The lounge reports a delay.", tradeoffChoices: [{ id: "p2-t1", label: "Keep the colleague here" }, { id: "p2-t2", label: "Send them back" }], actionDecision: { prompt: "Commit?", choices: [{ id: "p2-a1", label: "Tell the lounge lead now", isActionCommitment: true }, { id: "p2-a2", label: "Explain after the checks", isActionCommitment: false }] } },
  },
};

describe("7/9. an accepted review materializes complete evidence", () => {
  it("9. every canonical choice x every active boundary, and nothing else", () => {
    const active = [rule(1), rule(2)];
    const r = projectConstraintAssessments(draft, active, [evidence(1), evidence(2)], true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = enumerateChoices(draft).map((c) => c.id);
    expect(Object.keys(r.assessmentsByChoiceId).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(r.assessmentsByChoiceId[id].map((a) => a.constraintId)).toEqual(["c1_rule", "c2_rule"]);
      expect(r.assessmentsByChoiceId[id].every((a) => a.status === "satisfied")).toBe(true);
    }
  });

  it("7. the projection satisfies the SAME canonical gate the generator's attestation used to face", () => {
    const active = [rule(1), rule(2)];
    const r = projectConstraintAssessments(draft, active, [evidence(1), evidence(2)], true);
    expect(r.ok && validateConstraintAssessments(draft, ["c1_rule", "c2_rule"], r.assessmentsByChoiceId).ok).toBe(true);
  });

  it("the rationale comes from the REVIEWER, never from the generator", () => {
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1)], true);
    expect(r.ok && r.assessmentsByChoiceId.p1[0].rationale).toMatch(/^independent review confirmed compliance with \[c1_rule\]/);
    expect(r.ok && r.assessmentsByChoiceId.p1[0].rationale).toContain("Rule 1 is established up front");
  });

  it("it is deterministic — same inputs, byte-identical evidence", () => {
    const a = projectConstraintAssessments(draft, [rule(1), rule(2)], [evidence(1), evidence(2)], true);
    const b = projectConstraintAssessments(draft, [rule(1), rule(2)], [evidence(2), evidence(1)], true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // boundary ORDER comes from the active list
  });

  it("no active boundary means no evidence to project, and that is not a failure", () => {
    expect(projectConstraintAssessments(draft, [], [], false)).toEqual({ ok: true, assessmentsByChoiceId: {} });
  });

  it("a 100-character reviewer note still produces a usable rationale", () => {
    const note = "x".repeat(GEN_REVIEW_TEXT_MAX);
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1, { conciseExplanation: note })], true);
    expect(r.ok && r.assessmentsByChoiceId.p1[0].rationale).toContain(note);
  });
});

describe("8. a rejected or incomplete review projects NOTHING", () => {
  it("8. nothing is materialized before acceptance", () => {
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1)], false);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("projection_before_acceptance");
  });

  it("a boundary the review never assessed cannot be projected", () => {
    const r = projectConstraintAssessments(draft, [rule(1), rule(2)], [evidence(1)], true);
    expect(!r.ok && r.errors).toContain("projection_missing_boundary");
  });

  it("a boundary the review found ABSENT or inert cannot be projected", () => {
    expect(!projectConstraintAssessments(draft, [rule(1)], [evidence(1, { presentInScenario: false })], true).ok).toBe(true);
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1, { operationalized: false })], true);
    expect(!r.ok && r.errors).toContain("projection_boundary_not_established");
  });

  it("a boundary the review found VIOLATED at any phase cannot be projected", () => {
    for (const key of ["allPrimaryChoicesComply", "allTradeoffChoicesComply", "allActionChoicesComply", "allBranchesPreserve"] as const) {
      const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1, { [key]: false })], true);
      expect(!r.ok && r.errors, key).toContain("projection_boundary_not_compliant");
    }
  });

  it("a named violating choice or branch cannot be projected as satisfied", () => {
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1, { violatedChoiceReferences: ["Begin treatment first"] })], true);
    expect(!r.ok && r.errors).toContain("projection_boundary_violated");
  });

  it("evidence for a boundary that is not ACTIVE is rejected, not silently ignored", () => {
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1), evidence(9)], true);
    expect(!r.ok && r.errors).toContain("projection_unknown_boundary");
  });

  it("duplicated evidence for one boundary is rejected", () => {
    const r = projectConstraintAssessments(draft, [rule(1)], [evidence(1), evidence(1)], true);
    expect(!r.ok && r.errors).toContain("projection_duplicate_boundary");
  });
});

describe("10. legacy compatibility", () => {
  it("10. previously persisted assessments still parse against the unchanged canonical gate", () => {
    // Shape is identical to what the generator used to author, so old audit evidence still reads.
    const legacy = Object.fromEntries(
      enumerateChoices(draft).map((c) => [c.id, [{ constraintId: "c1_rule", status: "satisfied" as const, rationale: "legacy generator attestation" }]]),
    );
    expect(validateConstraintAssessments(draft, ["c1_rule"], legacy).ok).toBe(true);
  });
});
