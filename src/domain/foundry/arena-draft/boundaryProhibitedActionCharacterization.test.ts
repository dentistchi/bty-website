/**
 * CHARACTERIZATION ONLY · CURRENT BEHAVIOR · SEMANTIC CORRECTNESS NOT APPROVED
 * CLASSIFIER FORENSIC DEFERRED (Slice 3.2I-R5B1A.1-R2.54 Part 7).
 *
 * WHAT THIS FILE IS
 *
 * A record of what `classifyTruthState` does TODAY at a boundary whose rule kind is NOT a
 * prohibition, so that R2.54's canonical-alternative work can be judged on its own terms. R2.54
 * changed how a dependency group is accepted; it did not touch the classifier, and this file exists
 * to prove that — and to keep the behaviour visible until the separate forensic decides on it.
 *
 * WHAT IT IS NOT
 *
 * It is NOT an approval. `prohibited_action_present` resolving under a PREREQUISITE rule looks
 * semantically wrong: the state's own comment says a prohibition rule "has no prerequisite, so
 * performing the action IS the breach", and a prerequisite rule is a different kind of rule. Deciding
 * that is the classifier forensic's job, and this slice was explicitly not authorized to do it.
 *
 * Do not weaken, relax or delete these assertions because the behaviour looks suspicious. They are
 * the baseline the forensic will be measured against; a test that quietly stopped describing the
 * behaviour would erase the finding rather than resolve it.
 *
 * A green run here does NOT license a live replay. Live replay remains pending the classifier
 * forensic, independently of R2.54's local state.
 */

import { describe, it, expect } from "vitest";
import { TRUTH_STATES, classifyTruthState } from "./boundaryTruthStates";
import { deriveGroupAlternatives } from "./boundaryGroupAlternatives";
import { validateNarrowBoundaryReview, type BoundaryTruthAssessment } from "./narrowBoundaryReview";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import { R248_ATTEMPT_1 } from "./r248LiveDtoFixture";

const subject = buildNarrowBoundarySubject({
  scenarioSha256: C18_SCENARIO_SHA256,
  reviewSubjectSha256: "r".repeat(64),
  boundaryProvenance: { activeBoundaryIds: ["c1_verify"] } as never,
  boundaryProvenanceSha256: "p".repeat(64),
  boundaries: [C18_BOUNDARY],
  surfaces: C18_SURFACES,
  draft: C18_SCENARIO,
  language: "en",
  generationAttemptId: "g1",
  caseId: "c18",
});
const FRAME = buildSemanticFrames([C18_BOUNDARY])[0]!;
const CTX = {
  boundaries: [C18_BOUNDARY],
  surfaces: subject.surfaces,
  frames: buildSemanticFrames([C18_BOUNDARY]),
  candidates: subject.evidenceCandidates,
} as never;

/** The surface R2.53 proved invalid. Governed action present; the failure pool is empty. */
const RWS = "branch[0].resulting_world_state";

/** The exact facts under characterization. */
const FACTS = { governedActionStatus: "present", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable" } as const;

describe("[R2.54][7] CHARACTERIZATION ONLY — prohibited_action_present at a prerequisite boundary", () => {
  it("CURRENT BEHAVIOR: c18's frame is a PREREQUISITE rule, not a prohibition", () => {
    // Establishes the premise. If this ever changes, the rest of the file is describing something
    // else and must be re-derived rather than adjusted.
    expect(FRAME.ruleKind).not.toBe("prohibition");
    expect(FRAME.ruleKind).toBe("prerequisite_before_action");
  });

  it("CURRENT BEHAVIOR: the classifier returns prohibited_action_present under that rule kind", () => {
    const state = classifyTruthState(FACTS as never, FRAME.ruleKind);
    expect(state).not.toBeNull();
    expect(state!.id).toBe("prohibited_action_present");
    // SEMANTIC CORRECTNESS NOT APPROVED. This is what happens, not what should happen.
  });

  it("CURRENT BEHAVIOR: the ruleKind tiebreak is unreached because the match is unique", () => {
    /**
     * The mechanism, recorded so the forensic starts from the code rather than from a hypothesis.
     * `classifyTruthState` disambiguates on `ruleKind` ONLY when more than one state matches. Exactly
     * one state accepts (present, not_applicable, not_applicable), so the function returns on the
     * single-match path and the rule kind is never consulted.
     */
    const matches = TRUTH_STATES.filter(
      (s) =>
        s.governedActionStatus === FACTS.governedActionStatus &&
        s.prerequisiteStatus.includes(FACTS.prerequisiteStatus as never) &&
        s.temporalRelation.includes(FACTS.temporalRelation as never),
    );
    expect(matches.map((s) => s.id)).toEqual(["prohibited_action_present"]);
    // Same answer for every rule kind, including "prohibition" — the tiebreak cannot fire.
    for (const ruleKind of ["prerequisite_before_action", "prohibition", "uncertain"]) {
      expect(classifyTruthState(FACTS as never, ruleKind)?.id, ruleKind).toBe("prohibited_action_present");
    }
  });

  it("CURRENT BEHAVIOR: the canonical ROW VALIDATOR accepts a row in that state", () => {
    const rows: BoundaryTruthAssessment[] = R248_ATTEMPT_1.map((r) =>
      r.surfaceRef === RWS
        ? ({
            ...r,
            governedActionStatus: "present",
            prerequisiteStatus: "not_applicable",
            temporalRelation: "not_applicable",
            prerequisiteSatisfactionCandidateId: "none",
            prerequisiteFailureCandidateId: "none",
            reason: "",
          } as BoundaryTruthAssessment)
        : r,
    );
    const v = validateNarrowBoundaryReview({ assessments: rows }, CTX);
    // Other rows in the captured attempt-1 are independently invalid; this row is not among them.
    const failed = v.ok ? [] : v.failedSurfaceRefs;
    expect(failed).not.toContain(RWS);
  });

  it("CURRENT BEHAVIOR: the R2.54 alternative generator preserves that parity exactly", () => {
    /**
     * PARITY, NOT ENDORSEMENT. R2.54's generator offers a state only if it round-trips through the
     * SAME classifier the validator uses. It therefore offers `prohibited_action_present` here — not
     * because this slice judged the state appropriate, but because refusing to offer what the
     * validator accepts would put a SECOND authority in the codebase, which is the drift R2.48
     * measured. Generator and validator agree; whether they are both right is the forensic's question.
     */
    const alternatives = deriveGroupAlternatives({
      boundaryId: "c1_verify",
      surfaceRef: RWS,
      governedActionStatus: "present",
      groupFields: ["prerequisiteStatus", "temporalRelation", "prerequisiteSatisfactionCandidateId", "prerequisiteFailureCandidateId", "reason"],
      ruleKind: FRAME.ruleKind,
      candidates: subject.evidenceCandidates,
    });
    const offered = alternatives.find((a) => a.stateId === "prohibited_action_present");
    expect(offered).toBeDefined();
    expect(offered!.prerequisiteStatus).toBe("not_applicable");
    expect(offered!.temporalDomain).toContain("not_applicable");
    // Every alternative round-trips; this one is not a special case in the generator.
    for (const a of alternatives) {
      for (const t of a.temporalDomain) {
        expect(
          classifyTruthState({ governedActionStatus: "present", prerequisiteStatus: a.prerequisiteStatus, temporalRelation: t } as never, FRAME.ruleKind)?.id,
          a.alternativeId,
        ).toBe(a.stateId);
      }
    }
  });

  it("R2.54 DID NOT INTRODUCE THIS: the table row and the classifier predate this slice", () => {
    /**
     * The state, its acceptance conditions and its derived verdict all live in the R2.38 truth-state
     * table, and the single-match return path is the original `classifyTruthState`. R2.54 added the
     * alternative generator, the group matcher and the merge seam; none of them decide this.
     */
    const state = TRUTH_STATES.find((s) => s.id === "prohibited_action_present")!;
    expect(state.governedActionStatus).toBe("present");
    expect(state.prerequisiteStatus).toEqual(["not_applicable"]);
    expect(state.temporalRelation).toEqual(["unrelated", "not_applicable"]);
    expect(state.derivedCompliance).toBe("violates");
    expect(state.verdictEffect).toBe("violation");
    expect(state.reasonAuthority).toBe("server_derived");
  });

  it("CLASSIFIER FORENSIC DEFERRED: this file approves nothing and licenses no live replay", () => {
    // A deliberately unconditional statement of scope, so no reader mistakes a green run for a
    // decision. R2.54 was authorized to bind the repair authority, not to change the classifier.
    const scope = {
      classifyTruthStateModifiedByThisSlice: false,
      prohibitedActionPresentSemanticsApproved: false,
      liveReplayAuthorizedByThisFile: false,
      forensicOwner: "separate classifier forensic",
    } as const;
    expect(scope.classifyTruthStateModifiedByThisSlice).toBe(false);
    expect(scope.prohibitedActionPresentSemanticsApproved).toBe(false);
    expect(scope.liveReplayAuthorizedByThisFile).toBe(false);
  });
});
