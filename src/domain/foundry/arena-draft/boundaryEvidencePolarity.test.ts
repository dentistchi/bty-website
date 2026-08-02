/**
 * PREREQUISITE EVIDENCE POLARITY AUTHORITY (Slice 3.2I-R5B1A.1-R2.44 Parts 5-7).
 *
 * R2.42's live review produced a complete twelve-surface matrix and ten findings, eight false. Five
 * came from one span used as prerequisite FAILURE evidence while affirmatively proving the
 * prerequisite was MET. This file proves that class is now structurally impossible, that genuine
 * failure evidence survives, and that the rule moves with the canonical frame rather than with any
 * clinical vocabulary.
 */
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_POLARITY,
  assessEvidencePolarity,
  evidencePolarityContractSha256,
  polarityRefusal,
} from "./boundaryEvidencePolarity";
import { buildAllEvidenceCandidates, poolFor } from "./boundaryEvidenceCandidates";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { deriveBoundaryVerdict, type BoundaryTruthAssessment, type NarrowReviewContext } from "./narrowBoundaryReview";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO } from "./c18BoundaryFixture";
import {
  R242_APPLICABILITY_FALSE_POSITIVES,
  R242_BOUNDARY_REVIEW_SUBJECT_SHA256,
  R242_LIVE_MERGED_MATRIX,
  R242_MEASURED,
  R242_POLARITY_FALSE_POSITIVES,
  R242_TRUE_POSITIVES,
} from "./r242LiveDtoFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const build = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates: build.candidates };
const pool = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  poolFor(build.candidates, C18_BOUNDARY.id, ref, role);
const first = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  pool(ref, role)[0]?.candidateId ?? NO_CANDIDATE;

const C18_CLAUSE = "Two identifiers must be verified";
const INVERTED = R242_MEASURED.invertedSpan;
const GENUINE_FAILURE = "but this left the second patient unverified, creating potential safety concerns and administrative issues.";

// ---------------------------------------------------------------------------
// The classifier
// ---------------------------------------------------------------------------

describe("[R2.44] frame-relative polarity classification", () => {
  it("classifies the measured inverted span as satisfaction, never failure", () => {
    const a = assessEvidencePolarity(C18_CLAUSE, INVERTED);
    expect(a.polarity).toBe("satisfaction_only");
    expect(a.affirmativeSatisfactionSignals).toContain("completion:have verified");
    expect(a.failureAbsenceSignals).toEqual([]);
    expect(polarityRefusal("prerequisite_failure", a.polarity)).toBe("boundary_candidate_polarity_satisfaction_not_failure");
    expect(polarityRefusal("prerequisite_satisfaction", a.polarity)).toBeNull();
  });

  it("classifies the measured genuine failure span as failure, never satisfaction", () => {
    const a = assessEvidencePolarity(C18_CLAUSE, GENUINE_FAILURE);
    expect(a.polarity).toBe("failure_only");
    expect(polarityRefusal("prerequisite_failure", a.polarity)).toBeNull();
    expect(polarityRefusal("prerequisite_satisfaction", a.polarity)).toBe("boundary_candidate_polarity_failure_not_satisfaction");
  });

  it("does NOT collapse `verified` into `unverified` — the stem is a substring of both", () => {
    // `clauseStems` yields `verif`, which appears inside both words. The prefix decides.
    const met = assessEvidencePolarity(C18_CLAUSE, "You have verified identifiers for both patients");
    const unmet = assessEvidencePolarity(C18_CLAUSE, "the second patient remains unverified");
    expect(met.polarity).toBe("satisfaction_only");
    expect(unmet.polarity).toBe("failure_only");
    expect(unmet.prerequisiteTokenMatches.find((m) => m.token === "unverified")!.morphologicallyNegated).toBe(true);
    expect(met.prerequisiteTokenMatches.find((m) => m.token === "verified")!.morphologicallyNegated).toBe(false);
  });

  it("counts signals LOCALLY — a distant negation about something else does not flip the span", () => {
    // "without compromising on safety" is nine tokens from the nearest prerequisite term and is
    // about safety, not verification. R2.39 measured a rule without this window stripping the safe
    // branch of its only satisfaction evidence.
    expect(INVERTED).toContain("without compromising on safety");
    expect(assessEvidencePolarity(C18_CLAUSE, INVERTED).polarity).toBe("satisfaction_only");
  });

  it("a span that never mentions the prerequisite is unrelated, and one that points neither way is uncertain", () => {
    expect(assessEvidencePolarity(C18_CLAUSE, "but you still face delays in the ward due to the surge in admissions.").polarity).toBe("unrelated");
    // The scenario's statement of the RULE: about the prerequisite, asserting nothing about it.
    expect(assessEvidencePolarity(C18_CLAUSE, "but you must first verify two identifiers for each before proceeding.").polarity).toBe("uncertain");
  });

  it("exposes the full assessment and a contract digest", () => {
    const a = assessEvidencePolarity(C18_CLAUSE, INVERTED);
    expect(a.spanSha256).toMatch(/^[0-9a-f]{16}$/);
    expect(a.prerequisiteTerms).toEqual(["identifier", "verif"]);
    expect([...EVIDENCE_POLARITY]).toContain("mixed");
    expect(evidencePolarityContractSha256()).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Part 6 — synthetic cross-domain
// ---------------------------------------------------------------------------

describe("[R2.44][6] the authority moves with the canonical prerequisite clause", () => {
  const DUAL = "Dual authorization must be recorded";

  it("derives its terms from the supplied frame, not from any clinical list", () => {
    const a = assessEvidencePolarity(DUAL, "Dual authorization was recorded before disbursement.");
    expect(a.prerequisiteTerms).toEqual(["dual", "authoriz", "record"]);
    expect(a.prerequisiteTerms).not.toContain("verif");
    // …and c18's own vocabulary carries no authority under this boundary.
    expect(assessEvidencePolarity(DUAL, "You have verified identifiers for both patients").polarity).toBe("unrelated");
  });

  it("satisfaction forms", () => {
    for (const span of ["Dual authorization was recorded before disbursement.", "Both required authorizations were recorded."]) {
      expect(assessEvidencePolarity(DUAL, span).polarity, span).toBe("satisfaction_only");
    }
  });

  it("failure forms — explicit negation, deficient quantity, and absence", () => {
    expect(assessEvidencePolarity(DUAL, "Dual authorization was not recorded before disbursement.").polarity).toBe("failure_only");
    expect(assessEvidencePolarity(DUAL, "The second authorization remains missing.").polarity).toBe("failure_only");
    // "Only one … was recorded" asserts both a completion and a deficiency: mixed, and mixed keeps
    // FAILURE eligibility, which is the safe direction.
    const partial = assessEvidencePolarity(DUAL, "Only one authorization was recorded before funds were released.");
    expect(partial.polarity).toBe("mixed");
    expect(polarityRefusal("prerequisite_failure", partial.polarity)).toBeNull();
  });

  it("a contrast clause reverses an affirmative opening — 'but … remains missing'", () => {
    const a = assessEvidencePolarity(DUAL, "One authorization was recorded, but the second remains missing.");
    expect(a.polarity).toBe("mixed");
    expect(a.affirmativeSatisfactionSignals.length).toBeGreaterThan(0);
    expect(a.failureAbsenceSignals.some((s) => s.startsWith("contrast:"))).toBe(true);
    expect(polarityRefusal("prerequisite_satisfaction", a.polarity)).toBe("boundary_candidate_polarity_mixed_not_satisfaction");
  });

  it("an unresolved mention stays uncertain rather than being forced", () => {
    expect(assessEvidencePolarity(DUAL, "The authorization status was reviewed.").polarity).toBe("uncertain");
  });
});

// ---------------------------------------------------------------------------
// Part 3/4 — pool authority, including inherited spans
// ---------------------------------------------------------------------------

describe("[R2.44][3][4] pool authority applies identically to own and inherited spans", () => {
  it("the inverted span is gone from EVERY failure pool it reached", () => {
    for (const c of build.candidates) {
      if (c.semanticRole !== "prerequisite_failure") continue;
      expect(c.excerpt, `${c.candidateId} on ${c.assessedSurfaceRef}`).not.toContain("You have verified identifiers for both patients");
    }
    // 3-f1 on the source surface AND 4-f1…7-f1 inherited by its descendants.
    expect(pool("branch[0].resulting_world_state", "prerequisite_failure")).toHaveLength(0);
    for (const ref of ["branch[0].tradeoff[0]", "branch[0].tradeoff[1]", "branch[0].action[0]", "branch[0].action[1]"]) {
      expect(pool(ref, "prerequisite_failure"), ref).toHaveLength(0);
    }
  });

  it("its SATISFACTION form remains available where it belongs", () => {
    expect(pool("branch[0].resulting_world_state", "prerequisite_satisfaction").some((c) => c.excerpt.includes("You have verified identifiers"))).toBe(true);
  });

  it("genuine failure evidence survives on every branch[1] surface", () => {
    for (const ref of ["branch[1].resulting_world_state", "branch[1].tradeoff[0]", "branch[1].tradeoff[1]", "branch[1].action[0]", "branch[1].action[1]"]) {
      const f = pool(ref, "prerequisite_failure");
      expect(f, ref).toHaveLength(1);
      expect(f[0]!.excerpt, ref).toContain("left the second patient unverified");
    }
  });

  it("no candidate id is reassigned to a different span", () => {
    for (const c of build.candidates) {
      const [, role] = c.candidateId.split("-");
      expect(role![0]).toBe(c.semanticRole === "governed_action" ? "a" : c.semanticRole === "prerequisite_satisfaction" ? "s" : "f");
    }
    // Ids remain unique across the whole map.
    expect(new Set(build.candidates.map((c) => c.candidateId)).size).toBe(build.candidates.length);
  });

  it("the governed-action pools are untouched — applicability is OUT OF SCOPE", () => {
    expect(pool("primary[0]", "governed_action")).toHaveLength(0);
    expect(pool("branch[1].tradeoff[0]", "governed_action").map((c) => c.excerpt)).toEqual(["Prepare a summary of events for the administrator"]);
    expect(pool("branch[1].action[1]", "governed_action").map((c) => c.excerpt)).toEqual(["Immediately treat the second patient"]);
  });
});

// ---------------------------------------------------------------------------
// Part 5 — the captured R2.42 regressions
// ---------------------------------------------------------------------------

describe("[R2.44][5A] the captured R2.42 matrix, revalidated", () => {
  it("the rows that selected the inverted span can no longer derive a finding", () => {
    expect(R242_BOUNDARY_REVIEW_SUBJECT_SHA256).toBe("ca26ac27034eb5fbbae61db0af39b6a18330892c53a85e8fc04554ca92102647");
    const d = deriveBoundaryVerdict({ assessments: R242_LIVE_MERGED_MATRIX }, ctx);
    // Their candidate ids no longer exist, so the historical selections are refused outright.
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_candidate_unknown");
    for (const ref of R242_POLARITY_FALSE_POSITIVES) expect(d.failedSurfaceRefs).toContain(ref);
    // NO product verdict from a matrix whose selections are no longer authoritative.
    expect("violations" in d).toBe(false);
  });

  it("primary[0] stays valid and protected, and the branch[1] true positives stay candidate-valid", () => {
    const d = deriveBoundaryVerdict({ assessments: R242_LIVE_MERGED_MATRIX }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.validSurfaceRefs).toContain("primary[0]");
    for (const ref of R242_TRUE_POSITIVES) expect(d.validSurfaceRefs).toContain(ref);
  });
});

describe("[R2.44][5B] the canonical post-polarity matrix", () => {
  /**
   * Every R2.42 row rebuilt from AUTHORITATIVE candidates only. Where the polarity authority emptied
   * the failure pool, `explicitly_missing` is no longer expressible and the honest answer is the
   * non-governing shape. Nothing else about the reviewer's judgement is altered — in particular the
   * three applicability false positives are carried across exactly as the model produced them.
   */
  const postPolarity = (): BoundaryTruthAssessment[] =>
    R242_LIVE_MERGED_MATRIX.map((r) => {
      const failure = pool(r.surfaceRef, "prerequisite_failure");
      if (r.prerequisiteStatus !== "explicitly_missing") return r;
      if (failure.length === 0) {
        return {
          ...r,
          governedActionStatus: "absent" as const,
          prerequisiteStatus: "not_applicable" as const,
          temporalRelation: "not_applicable" as const,
          governedActionCandidateId: first(r.surfaceRef, "governed_action"),
          prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
          prerequisiteFailureCandidateId: NO_CANDIDATE,
        };
      }
      return { ...r, prerequisiteFailureCandidateId: failure[0]!.candidateId };
    });

  it("every POLARITY false positive is gone", () => {
    const d = deriveBoundaryVerdict({ assessments: postPolarity() }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const ref of R242_POLARITY_FALSE_POSITIVES) {
      expect(d.violations.map((v) => v.surfaceRef), ref).not.toContain(ref);
    }
  });

  it("the known true positives are preserved", () => {
    const d = deriveBoundaryVerdict({ assessments: postPolarity() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    for (const ref of R242_TRUE_POSITIVES) expect(d.violations.map((v) => v.surfaceRef)).toContain(ref);
  });

  it("the APPLICABILITY false positives are STILL OBSERVABLE — this is not a product PASS", () => {
    const d = deriveBoundaryVerdict({ assessments: postPolarity() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    // R2.44 fixes one class. Three findings whose failure evidence is correct but whose governed
    // action is an administrative task remain, and are separately queued.
    for (const ref of R242_APPLICABILITY_FALSE_POSITIVES) expect(d.violations.map((v) => v.surfaceRef)).toContain(ref);
    expect(d.violations).toHaveLength(R242_TRUE_POSITIVES.length + R242_APPLICABILITY_FALSE_POSITIVES.length);
  });

  it("primary[1] remains missed — ancestor attribution is out of scope", () => {
    const d = deriveBoundaryVerdict({ assessments: postPolarity() }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((v) => v.surfaceRef)).not.toContain("primary[1]");
    expect(R242_MEASURED.primaryOneLiveDetection).toBe("MISSED 7/7");
  });
});

// ---------------------------------------------------------------------------
// Part 7 — observability
// ---------------------------------------------------------------------------

describe("[R2.44][7] the prior 15 collisions are reconciled, not silently dropped", () => {
  it("every historical collision is classified", () => {
    const m = build.polarityMetrics;
    expect(m.prerequisiteSatisfactionRefusedFromFailureCount).toBe(5);
    expect(m.prerequisiteFailureRefusedFromSatisfactionCount).toBe(5);
    expect(m.prerequisiteSameSpanCrossPoolObservedCount).toBe(5);
    // 5 refused one way + 5 the other + 5 still legitimately in both = the 15 R2.39 measured.
    expect(
      m.prerequisiteSatisfactionRefusedFromFailureCount +
        m.prerequisiteFailureRefusedFromSatisfactionCount +
        m.prerequisiteSameSpanCrossPoolObservedCount,
    ).toBe(15);
  });

  it("the residue is the UNCERTAIN class, observed rather than forced", () => {
    const stillBoth = C18_REACHABLE_SURFACES.flatMap((s) => {
      const sat = new Set(pool(s.coordinate, "prerequisite_satisfaction").map((c) => c.excerpt));
      return pool(s.coordinate, "prerequisite_failure").filter((c) => sat.has(c.excerpt));
    });
    expect(stillBoth).toHaveLength(5);
    for (const c of stillBoth) expect(assessEvidencePolarity(C18_CLAUSE, c.excerpt).polarity).toBe("uncertain");
    expect(build.polarityMetrics.prerequisitePolarityUncertainCount).toBeGreaterThan(0);
  });

  it("reports the full polarity distribution", () => {
    const m = build.polarityMetrics;
    expect(m.prerequisiteSatisfactionOnlyCount).toBeGreaterThan(0);
    expect(m.prerequisiteFailureOnlyCount).toBeGreaterThan(0);
    expect(m.prerequisiteMixedCount).toBe(0); // none in c18
    expect(build.polarityDecisions.length).toBeGreaterThan(0);
    const d = build.polarityDecisions.find((x) => x.refusalCode === "boundary_candidate_polarity_satisfaction_not_failure")!;
    expect(d.role).toBe("prerequisite_failure");
    expect(d.span).toContain("You have verified identifiers");
    expect(d.spanSha256).toMatch(/^[0-9a-f]{16}$/);
  });
});
