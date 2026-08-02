/**
 * CANONICAL DEPENDENCY-GROUP SHAPE AUTHORITY (Slice 3.2I-R5B1A.1-R2.54).
 *
 * R2.53 measured the live patch that broke R2.52. Every scalar it sent was in its
 * field's `allowedValues`, the dependency group was complete, and the merged row
 * was still refused — because `prerequisiteStatus: not_established` selects a
 * state whose `reasonAuthority` is `model_required`, and `reason` was frozen at
 * `""` from attempt 1 where the state was `server_derived`.
 *
 * Two defects, one root: the group is a set of independent scalars rather than a
 * canonical row shape. Per-field membership never proved the tuple, and `reason`
 * could never enter the closure because it was not a repairable field at all.
 *
 * These tests are written before the implementation and describe the contract:
 * a multi-field group is accepted only by MATCHING A CANONICAL ALTERNATIVE
 * derived from the truth-state table, and `reason` is part of that alternative.
 */

import { describe, expect, it } from "vitest"
import {
  deriveGroupAlternatives,
  groupAlternativesSha256,
  matchGroupAlternative,
  REASON_CONSTRAINTS,
} from "./boundaryGroupAlternatives"
import { TRUTH_STATES, classifyTruthState } from "./boundaryTruthStates"
import { MODEL_REASON_MIN_CHARS } from "./boundaryReasonParity"
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract"
import { buildSemanticFrames } from "./boundarySemanticFrame"
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture"

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
})
const CANDIDATES = subject.evidenceCandidates
const FRAME = buildSemanticFrames([C18_BOUNDARY])[0]!

/** The surface R2.53 proved invalid: governed action present, failure pool EMPTY. */
const RWS = "branch[0].resulting_world_state"
const GROUP_FIELDS = [
  "prerequisiteStatus",
  "temporalRelation",
  "prerequisiteSatisfactionCandidateId",
  "prerequisiteFailureCandidateId",
  "reason",
] as const

const alternativesFor = (surfaceRef: string, governedActionStatus: string, fields = GROUP_FIELDS) =>
  deriveGroupAlternatives({
    boundaryId: "c1_verify",
    surfaceRef,
    governedActionStatus,
    groupFields: [...fields],
    ruleKind: FRAME.ruleKind,
    candidates: CANDIDATES,
  })

const poolOf = (surfaceRef: string, role: string) =>
  CANDIDATES.filter((c) => c.assessedSurfaceRef === surfaceRef && c.semanticRole === role)

// ---------------------------------------------------------------------------
// Part 3 — alternatives are DERIVED, never enumerated by hand
// ---------------------------------------------------------------------------

describe("[R2.54][3] canonical alternatives come from the truth-state table", () => {
  it("every alternative round-trips through the canonical classifier", () => {
    // The generator and the validator must agree BY CONSTRUCTION. R2.48 taught
    // this: a hand-written second copy of the requirements had already drifted.
    for (const alt of alternativesFor(RWS, "present")) {
      const state = classifyTruthState(
        {
          governedActionStatus: "present",
          prerequisiteStatus: alt.prerequisiteStatus,
          temporalRelation: alt.temporalDomain[0]!,
        } as never,
        FRAME.ruleKind,
      )
      expect(state, alt.alternativeId).not.toBeNull()
      expect(state?.id, alt.alternativeId).toBe(alt.stateId)
    }
  })

  it("every temporal value an alternative offers is legal for its state", () => {
    for (const alt of alternativesFor(RWS, "present")) {
      const state = TRUTH_STATES.find((s) => s.id === alt.stateId)!
      for (const t of alt.temporalDomain) expect(state.temporalRelation).toContain(t)
    }
  })

  it("no alternative is produced for a governed-action status it does not belong to", () => {
    for (const alt of alternativesFor(RWS, "present")) {
      expect(TRUTH_STATES.find((s) => s.id === alt.stateId)?.governedActionStatus).toBe("present")
    }
  })

  it("the alternative set is non-empty and deterministic", () => {
    const first = alternativesFor(RWS, "present")
    expect(first.length).toBeGreaterThan(0)
    expect(groupAlternativesSha256(first)).toBe(groupAlternativesSha256(alternativesFor(RWS, "present")))
  })
})

// ---------------------------------------------------------------------------
// Part 3 — groundability exclusions
// ---------------------------------------------------------------------------

describe("[R2.54][3] an alternative the pools cannot ground is excluded", () => {
  it("branch[0].rws has an EMPTY failure pool, so failure-requiring states are excluded", () => {
    expect(poolOf(RWS, "prerequisite_failure")).toHaveLength(0)
    const ids = alternativesFor(RWS, "present").map((a) => a.stateId)
    // Both states that REQUIRE failure evidence are unavailable here. This is
    // R2.48's empty-pool authority, applied before the model is ever asked.
    expect(ids).not.toContain("governed_action_prerequisite_missing")
    expect(ids).not.toContain("governed_action_prerequisite_contradicted")
  })

  it("a satisfaction-requiring state IS available where its pool is non-empty", () => {
    expect(poolOf(RWS, "prerequisite_satisfaction").length).toBeGreaterThan(0)
    const ids = alternativesFor(RWS, "present").map((a) => a.stateId)
    expect(ids).toContain("governed_action_prerequisite_satisfied")
  })

  it("a model-required state is excluded when `reason` is NOT in the group", () => {
    // Without the reason closure the state cannot be answered, so offering it
    // would be offering a shape the model cannot legally complete — exactly the
    // trap R2.53 measured.
    const withoutReason = alternativesFor(RWS, "present", [
      "prerequisiteStatus",
      "temporalRelation",
      "prerequisiteSatisfactionCandidateId",
      "prerequisiteFailureCandidateId",
    ] as never)
    for (const alt of withoutReason) expect(alt.reasonAuthority).toBe("server_derived")
    expect(withoutReason.map((a) => a.stateId)).not.toContain("governed_action_prerequisite_not_established")
  })

  it("with `reason` in the group, model-required states become available", () => {
    const ids = alternativesFor(RWS, "present").map((a) => a.stateId)
    expect(ids).toContain("governed_action_prerequisite_not_established")
  })

  it("candidate domains are surface-local and role-correct", () => {
    for (const alt of alternativesFor(RWS, "present")) {
      for (const id of alt.satisfactionCandidateDomain) {
        if (id === "none") continue
        const c = CANDIDATES.find((x) => x.candidateId === id)!
        expect(c.assessedSurfaceRef).toBe(RWS)
        expect(c.semanticRole).toBe("prerequisite_satisfaction")
      }
      for (const id of alt.failureCandidateDomain) {
        if (id === "none") continue
        const c = CANDIDATES.find((x) => x.candidateId === id)!
        expect(c.assessedSurfaceRef).toBe(RWS)
        expect(c.semanticRole).toBe("prerequisite_failure")
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Parts 2 + 6 — reason authority
// ---------------------------------------------------------------------------

describe("[R2.54][2] reason is governed by authority, never by an enumerated list", () => {
  it("every alternative declares a reason constraint", () => {
    for (const alt of alternativesFor(RWS, "present")) {
      expect(REASON_CONSTRAINTS).toContain(alt.reasonConstraint)
    }
  })

  it("server-derived alternatives require the canonical EMPTY reason", () => {
    for (const alt of alternativesFor(RWS, "present").filter((a) => a.reasonAuthority === "server_derived")) {
      expect(alt.reasonConstraint).toBe("must_be_empty")
    }
  })

  it("model-required alternatives require model prose", () => {
    const modelAlts = alternativesFor(RWS, "present").filter((a) => a.reasonAuthority === "model_required")
    expect(modelAlts.length).toBeGreaterThan(0)
    for (const alt of modelAlts) expect(alt.reasonConstraint).toBe("model_required")
  })
})

// ---------------------------------------------------------------------------
// Part 6 — matching is the ONLY acceptance authority
// ---------------------------------------------------------------------------

describe("[R2.54][6] a group is accepted only by matching one complete alternative", () => {
  const alts = () => alternativesFor(RWS, "present")

  const satisfied = () => alts().find((a) => a.stateId === "governed_action_prerequisite_satisfied")!
  const notEstablished = () => alts().find((a) => a.stateId === "governed_action_prerequisite_not_established")!

  it("a valid SERVER-DERIVED selection matches", () => {
    const alt = satisfied()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: alt.satisfactionCandidateDomain.find((x) => x !== "none")!,
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.alternativeId).toBe(alt.alternativeId)
  })

  it("a valid MODEL-REQUIRED selection matches when reason satisfies the contract", () => {
    const alt = notEstablished()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "the world state never says whether either identifier was checked before treatment",
    })
    expect(r.ok).toBe(true)
  })

  it("THE R2.53 LIVE FAILURE: model-required state with the frozen empty reason is refused BEFORE merge", () => {
    const alt = notEstablished()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: "not_applicable",
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("field_repair_group_reason_required_missing")
  })

  it("a server-derived alternative with a non-empty reason is refused", () => {
    const alt = satisfied()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: alt.satisfactionCandidateDomain.find((x) => x !== "none")!,
      prerequisiteFailureCandidateId: "none",
      reason: "the server writes this explanation, not the model",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("field_repair_group_reason_forbidden_present")
  })

  it("whitespace-only prose is not model reason", () => {
    const alt = notEstablished()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "   \n\t  ",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("field_repair_group_reason_required_missing")
  })

  it("prose shorter than the existing contract is refused as invalid, not accepted", () => {
    const alt = notEstablished()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "x".repeat(Math.max(1, MODEL_REASON_MIN_CHARS - 1)),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(["field_repair_group_reason_required_missing", "field_repair_group_reason_invalid"]).toContain(r.code)
  })

  it("MIXING two alternatives is refused", () => {
    // `satisfied` prerequisite with the temporal relation of a different state.
    const alt = satisfied()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: "action_before_prerequisite",
      prerequisiteSatisfactionCandidateId: alt.satisfactionCandidateDomain.find((x) => x !== "none")!,
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("field_repair_group_shape_not_allowed")
  })

  it("an UNAVAILABLE state is refused even though its scalars are individually plausible", () => {
    // `explicitly_missing` + `action_before_prerequisite` is a real canonical
    // state — but its failure pool is empty here, so it was never offered.
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: "explicitly_missing",
      temporalRelation: "action_before_prerequisite",
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe("field_repair_group_shape_not_allowed")
  })

  it("a required candidate that is missing is refused", () => {
    const alt = satisfied()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: "none",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(false)
  })

  it("a forbidden candidate that is supplied is refused", () => {
    const alt = notEstablished()
    const sat = poolOf(RWS, "prerequisite_satisfaction")[0]!.candidateId
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      prerequisiteSatisfactionCandidateId: sat,
      prerequisiteFailureCandidateId: "none",
      reason: "the world state never says whether either identifier was checked before treatment",
    })
    expect(r.ok).toBe(false)
  })

  it("a candidate outside the alternative's surface-local domain is refused", () => {
    const alt = satisfied()
    const r = matchGroupAlternative(alts(), {
      prerequisiteStatus: alt.prerequisiteStatus,
      temporalRelation: alt.temporalDomain[0]!,
      // A satisfaction candidate belonging to another surface.
      prerequisiteSatisfactionCandidateId: "8-s1",
      prerequisiteFailureCandidateId: "none",
      reason: "",
    })
    expect(r.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The measured Cartesian gap this slice closes
// ---------------------------------------------------------------------------

describe("[R2.54] scalar membership is no longer sufficient", () => {
  it("the alternative set is far smaller than the old scalar product", () => {
    const alts = alternativesFor(RWS, "present")
    // R2.53 measured 6 x 5 x 5 x 1 = 150 scalar combinations, of which only a
    // small canonical subset was valid. Alternatives ARE that subset, named.
    expect(alts.length).toBeLessThan(150)
    expect(alts.length).toBeGreaterThan(0)
  })

  it("no two alternatives share an id", () => {
    const ids = alternativesFor(RWS, "present").map((a) => a.alternativeId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
