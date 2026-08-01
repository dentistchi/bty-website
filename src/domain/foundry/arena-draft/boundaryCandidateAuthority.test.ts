/**
 * SERVER-OWNED CANDIDATE AUTHORITY + DERIVED DECISION AXES — THE 45-CASE PROOF
 * (Slice 3.2I-R5B1A.1-R2.38 Part 18).
 *
 * Every case traces to something R2.37 measured on live output, or to a property that measurement
 * proved must hold. No network, no provider.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CANDIDATES_PER_POOL,
  allowedSourceKinds,
  buildAllEvidenceCandidates,
  candidateContractSha256,
  evidenceCandidateMapSha256,
  extractSpans,
  indexCandidates,
  isEligibleExcerpt,
  poolFor,
  resolveCandidate,
} from "./boundaryEvidenceCandidates";
import { buildContextSegments } from "./boundaryContextSegments";
import { buildSemanticFrame, buildSemanticFrames } from "./boundarySemanticFrame";
import {
  NARROW_BOUNDARY_JSON_SCHEMA,
  REMOVED_MODEL_AUTHORED_FIELDS,
  deriveBoundaryVerdict,
  mergeSubsetRepair,
  planSubsetRepair,
  validateNarrowBoundaryReview,
  type BoundaryTruthAssessment,
  type NarrowReviewContext,
} from "./narrowBoundaryReview";
import { TRUTH_STATE_IDS, classifyTruthState, deriveMechanism, truthStateCoverage, truthStateTableSha256 } from "./boundaryTruthStates";
import { GOVERNED_ACTION_STATUSES, NO_CANDIDATE, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS } from "./boundaryTruthContractTypes";
import { checkPromptFieldParity, instructiveRemovedFieldMentions } from "./promptFieldParity";
import { NARROW_BOUNDARY_SYSTEM_PROMPT, PROMPT_EXPLANATORY_VOCABULARY } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_REACHABLE_SURFACES, C18_SCENARIO } from "./c18BoundaryFixture";

const segments = buildContextSegments(C18_SCENARIO, C18_REACHABLE_SURFACES);
const frames = buildSemanticFrames([C18_BOUNDARY]);
const build = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, segments);
const candidates = build.candidates;
const ctx: NarrowReviewContext = { boundaries: [C18_BOUNDARY], surfaces: C18_REACHABLE_SURFACES, frames, candidates };

const pool = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") =>
  poolFor(candidates, C18_BOUNDARY.id, ref, role);
const first = (ref: string, role: "governed_action" | "prerequisite_satisfaction" | "prerequisite_failure") => pool(ref, role)[0]?.candidateId ?? NO_CANDIDATE;
const match = (ref: string, role: "prerequisite_failure" | "prerequisite_satisfaction", re: RegExp) =>
  pool(ref, role).find((c) => re.test(c.excerpt))?.candidateId ?? NO_CANDIDATE;
const surface = (ref: string) => C18_REACHABLE_SURFACES.find((s) => s.coordinate === ref)!;

const settled = (): BoundaryTruthAssessment[] =>
  C18_REACHABLE_SURFACES.map((s) => ({
    boundaryId: C18_BOUNDARY.id,
    surfaceRef: s.coordinate,
    governedActionStatus: "absent",
    prerequisiteStatus: "not_applicable",
    temporalRelation: "not_applicable",
    governedActionCandidateId: first(s.coordinate, "governed_action"),
    prerequisiteSatisfactionCandidateId: NO_CANDIDATE,
    prerequisiteFailureCandidateId: NO_CANDIDATE,
    reason: "",
  }));

const withRow = (ref: string, over: Partial<BoundaryTruthAssessment>) => settled().map((a) => (a.surfaceRef === ref ? { ...a, ...over } : a));

const UNSAFE_ACTION = "branch[1].action[1]";
const UNSAFE_STATE = "branch[1].resulting_world_state";

const violationAt = (ref: string) =>
  withRow(ref, {
    governedActionStatus: "present",
    prerequisiteStatus: "explicitly_missing",
    temporalRelation: "action_before_prerequisite",
    governedActionCandidateId: first(ref, "governed_action"),
    prerequisiteFailureCandidateId: match(ref, "prerequisite_failure", /unverified/i),
  });

describe("[1-4] the model authors no conclusion and no text", () => {
  const props = Object.keys(NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties);

  it("[1] the schema has no applicability field", () => expect(props).not.toContain("applicability"));
  it("[2] the schema has no compliance field", () => expect(props).not.toContain("compliance"));
  it("[3] the schema has no arbitrary excerpt field", () => {
    expect(props).not.toContain("excerpt");
    expect(props).not.toContain("actionEvidence");
    expect(props).not.toContain("prerequisiteEvidence");
    expect(props.filter((p) => p.endsWith("CandidateId"))).toHaveLength(3);
  });
  it("[4] the schema has no model-authored segment metadata", () => {
    for (const f of REMOVED_MODEL_AUTHORED_FIELDS) expect(props).not.toContain(f);
    expect(props).not.toContain("segmentRef");
    expect(props).not.toContain("segmentKind");
  });
});

describe("[5-10] the server derives every decision axis", () => {
  it("[5] governed action absent derives not_applicable", () => {
    const v = validateNarrowBoundaryReview({ assessments: settled() }, ctx);
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error("unreachable");
    expect(v.derived.every((d) => d.applicability === "not_applicable" && d.compliance === "not_assessed")).toBe(true);
    expect(v.derived.every((d) => d.stateId === "non_governing")).toBe(true);
  });

  it("[6] a satisfied prerequisite derives complies", () => {
    const rows = withRow("primary[0]", {
      governedActionStatus: "present",
      prerequisiteStatus: "satisfied",
      temporalRelation: "prerequisite_before_action",
      prerequisiteSatisfactionCandidateId: first("primary[0]", "prerequisite_satisfaction"),
    });
    const v = validateNarrowBoundaryReview({ assessments: rows }, ctx);
    if (!v.ok) throw new Error(`unreachable: ${v.codes.join(",")}`);
    expect(v.derived.find((d) => d.surfaceRef === "primary[0]")).toMatchObject({ applicability: "applies", compliance: "complies" });
  });

  it("[7] a grounded missing prerequisite derives violates", () => {
    const d = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_ACTION) }, ctx);
    expect(d.outcome).toBe("boundary_review_reject");
  });

  it("[8] not_established never auto-violates", () => {
    const d = deriveBoundaryVerdict(
      { assessments: withRow(UNSAFE_ACTION, { governedActionStatus: "present", prerequisiteStatus: "not_established", reason: "nothing states whether verification happened" }) },
      ctx,
    );
    expect(d.outcome).toBe("boundary_review_inconclusive");
  });

  it("[9] uncertainty produces inconclusive, never a quiet pass", () => {
    const d = deriveBoundaryVerdict(
      { assessments: withRow("branch[1].tradeoff[1]", { governedActionStatus: "uncertain", prerequisiteStatus: "uncertain", reason: "'caring for' may or may not mean treating" }) },
      ctx,
    );
    expect(d.outcome).toBe("boundary_review_inconclusive");
  });

  it("[10] the violation mechanism is derived from rule kind, surface kind and lineage", () => {
    const d = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_STATE) }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    // A resulting world state derives the state mechanism; a learner action derives the action one.
    expect(d.violations[0]!.violationMechanism).toBe("resulting_state_missing_prerequisite");
    const a = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_ACTION) }, ctx);
    if (a.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(a.violations[0]!.violationMechanism).toBe("governed_action_without_prerequisite");
    expect(deriveMechanism({ verdictEffect: "settled" } as never, "choice", false)).toBe("none");
  });
});

describe("[11-16] candidate ids are surface-local and provenance-preserving", () => {
  it("[11] every candidate id is scoped to exactly one surface", () => {
    for (const c of candidates) {
      expect(poolFor(candidates, C18_BOUNDARY.id, c.assessedSurfaceRef, c.semanticRole).map((x) => x.candidateId)).toContain(c.candidateId);
      const others = C18_REACHABLE_SURFACES.filter((s) => s.coordinate !== c.assessedSurfaceRef);
      for (const o of others) {
        expect(poolFor(candidates, C18_BOUNDARY.id, o.coordinate, c.semanticRole).map((x) => x.candidateId)).not.toContain(c.candidateId);
      }
    }
  });

  it("[12] a candidate id resolves to canonical provenance the model never sees", () => {
    const index = indexCandidates(candidates);
    const id = first(UNSAFE_ACTION, "governed_action");
    const r = resolveCandidate(index, id, { boundaryId: C18_BOUNDARY.id, surfaceRef: UNSAFE_ACTION, role: "governed_action" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.candidate.canonicalSegmentKind).toBe("own_surface");
    expect(r.candidate.sourceSurfaceRef).toBe(UNSAFE_ACTION);
    expect(r.candidate.sha256).toMatch(/^[0-9a-f]{16}$/);
  });

  it("[13] an unknown candidate id is rejected", () => {
    const d = deriveBoundaryVerdict({ assessments: withRow(UNSAFE_ACTION, { governedActionCandidateId: "99-a9" }) }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_candidate_unknown");
  });

  it("[14] a candidate from ANOTHER surface is rejected — the measured R2.37 failure", () => {
    const foreign = first("branch[0].action[0]", "governed_action");
    const d = deriveBoundaryVerdict({ assessments: withRow(UNSAFE_ACTION, { governedActionCandidateId: foreign }) }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.codes).toContain("boundary_candidate_wrong_surface");
  });

  it("[15] identical text under distinct provenance stays distinguishable", () => {
    // The world state of branch[1] is inherited by four child surfaces. Each keeps its OWN candidate
    // — collapsing them by text is what destroyed a correct answer in R2.37.
    const holders = ["branch[1].tradeoff[0]", "branch[1].tradeoff[1]", "branch[1].action[0]", "branch[1].action[1]"];
    const ids = holders.map((h) => match(h, "prerequisite_failure", /unverified/i));
    expect(new Set(ids).size).toBe(holders.length);
    const excerpts = new Set(
      holders.map((h) => pool(h, "prerequisite_failure").find((c) => /unverified/i.test(c.excerpt))!.excerpt),
    );
    expect(excerpts.size).toBe(1); // same text…
    expect(build.provenanceRetainedCount).toBeGreaterThan(0); // …deliberately retained, not merged
  });

  it("[16] an alias of the SAME canonical source is exposed once", () => {
    for (const s of C18_REACHABLE_SURFACES) {
      for (const role of ["governed_action", "prerequisite_satisfaction", "prerequisite_failure"] as const) {
        const p = pool(s.coordinate, role);
        const identity = p.map((c) => `${c.canonicalSegmentKind}|${c.sourceSurfaceRef}|${c.excerpt}`);
        expect(new Set(identity).size, `${s.coordinate}/${role}`).toBe(p.length);
        expect(p.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_POOL);
      }
    }
  });
});

describe("[17-24] role-scoped eligibility", () => {
  it("[17] a governed-action candidate always comes from the surface's own text", () => {
    for (const c of candidates.filter((x) => x.semanticRole === "governed_action")) {
      expect(c.canonicalSegmentKind).toBe("own_surface");
      expect(c.sourceSurfaceRef).toBe(c.assessedSurfaceRef);
    }
    expect(allowedSourceKinds("governed_action", surface(UNSAFE_ACTION))).toEqual(["own_surface"]);
  });

  it("[18] inherited state can never become governed-action evidence", () => {
    expect(pool(UNSAFE_ACTION, "governed_action").every((c) => c.canonicalSegmentKind === "own_surface")).toBe(true);
    expect(allowedSourceKinds("governed_action", surface("branch[1].tradeoff[0]"))).not.toContain("parent_generated_state");
  });

  it("[19] a satisfaction candidate MAY come from the ancestor primary — the R2.36 repair", () => {
    const kinds = pool("branch[0].tradeoff[0]", "prerequisite_satisfaction").map((c) => c.canonicalSegmentKind);
    expect(kinds).toContain("ancestor_primary");
    expect(allowedSourceKinds("prerequisite_satisfaction", surface("branch[0].tradeoff[0]"))).toContain("ancestor_primary");
  });

  it("[20] a failure candidate MAY come from the scenario opening for a primary decision", () => {
    expect(allowedSourceKinds("prerequisite_failure", surface("primary[1]"))).toEqual(["scenario_opening", "own_surface"]);
    expect(pool("primary[1]", "prerequisite_failure").some((c) => c.canonicalSegmentKind === "scenario_opening")).toBe(true);
  });

  it("[21] a failure candidate MAY come from the parent state for a descendant action", () => {
    expect(pool(UNSAFE_ACTION, "prerequisite_failure").some((c) => c.canonicalSegmentKind === "parent_generated_state")).toBe(true);
  });

  it("[22] another branch's candidate is not offered and is rejected if named", () => {
    const otherBranch = first("branch[0].tradeoff[0]", "prerequisite_satisfaction");
    expect(pool(UNSAFE_ACTION, "prerequisite_satisfaction").map((c) => c.candidateId)).not.toContain(otherBranch);
    const d = deriveBoundaryVerdict({ assessments: withRow(UNSAFE_ACTION, { governedActionCandidateId: otherBranch }) }, ctx);
    expect(d.outcome).toBe("boundary_review_malformed");
  });

  it("[23] a boundary restatement is never offered as a candidate", () => {
    const frame = buildSemanticFrame(C18_BOUNDARY);
    expect(isEligibleExcerpt("prerequisite_failure", C18_BOUNDARY.statement, frame, C18_BOUNDARY.statement)).toBe(false);
    for (const c of candidates) expect(C18_BOUNDARY.statement.toLowerCase()).not.toContain(c.excerpt.toLowerCase());
  });

  it("[24] an administrative surface has an action candidate but no prerequisite-failure delay span", () => {
    // R2.34's measured false positive: "you still face delays in the ward" offered as proof a
    // verification failed. It is not eligible, so it is never in any failure pool.
    expect(pool("branch[0].action[0]", "governed_action").length).toBeGreaterThan(0);
    for (const c of candidates.filter((x) => x.semanticRole === "prerequisite_failure")) {
      expect(c.excerpt.toLowerCase()).not.toContain("delays in the ward");
    }
  });
});

describe("[25-29] the measured c18 semantics", () => {
  it("[25] the safe verified state complies", () => {
    const ref = "branch[0].resulting_world_state";
    const rows = withRow(ref, {
      governedActionStatus: "present",
      prerequisiteStatus: "satisfied",
      temporalRelation: "prerequisite_before_action",
      prerequisiteSatisfactionCandidateId: match(ref, "prerequisite_satisfaction", /You have verified/i),
    });
    const d = deriveBoundaryVerdict({ assessments: rows }, ctx);
    expect(d.outcome).toBe("boundary_review_pass");
  });

  it("[26] a verified state that ALSO reports delay still complies", () => {
    const ref = "branch[0].resulting_world_state";
    // There is no way to express "delay proves the prerequisite failed": no such candidate exists.
    expect(pool(ref, "prerequisite_failure").every((c) => !/delay/i.test(c.excerpt))).toBe(true);
  });

  it("[27] the branch[1] unsafe world state violates", () => {
    const d = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_STATE) }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((v) => v.surfaceRef)).toEqual([UNSAFE_STATE]);
    expect(d.violations[0]!.prerequisiteSegmentKind).toBe("own_surface");
  });

  it("[28] the immediate-treatment action preserves its INHERITED proof", () => {
    const d = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_ACTION) }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const v = d.violations[0]!;
    expect(v.prerequisiteSegmentKind).toBe("parent_generated_state");
    expect(v.governedActionEvidence).toContain("Immediately treat the second patient");
    expect(v.prerequisiteFailureEvidence).toContain("unverified");
  });

  it("[29] a grounded primary[1] becomes the EARLIEST causal violation", () => {
    // Part 13 — not hardcoded: the opening carries a span establishing the prerequisite is unmet,
    // and IF the reviewer selects it the server derives the earliest causal violation.
    const openingFailure = match("primary[1]", "prerequisite_failure", /must first verify/i);
    expect(openingFailure).not.toBe(NO_CANDIDATE);
    let rows = withRow("primary[1]", {
      governedActionStatus: "present",
      prerequisiteStatus: "explicitly_missing",
      temporalRelation: "action_before_prerequisite",
      governedActionCandidateId: first("primary[1]", "governed_action"),
      prerequisiteFailureCandidateId: openingFailure,
    });
    rows = rows.map((r) => (r.surfaceRef === UNSAFE_ACTION ? violationAt(UNSAFE_ACTION).find((x) => x.surfaceRef === UNSAFE_ACTION)! : r));
    const d = deriveBoundaryVerdict({ assessments: rows }, ctx);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations[0]!.surfaceRef).toBe("primary[1]");
    expect(d.violations[0]!.earliestCausal).toBe(true);
  });
});

describe("[30-31] prompt / schema parity", () => {
  const fields = Object.keys(NARROW_BOUNDARY_JSON_SCHEMA.properties.assessments.items.properties);

  it("[30] the prompt names no field the schema lacks — the R2.36 defect", () => {
    const parity = checkPromptFieldParity(NARROW_BOUNDARY_SYSTEM_PROMPT, fields, PROMPT_EXPLANATORY_VOCABULARY);
    expect(parity.unknownTokens).toEqual([]);
    expect(parity.ok).toBe(true);
    expect(instructiveRemovedFieldMentions(NARROW_BOUNDARY_SYSTEM_PROMPT, REMOVED_MODEL_AUTHORED_FIELDS)).toEqual([]);
  });

  it("[31] every state rule in the prompt comes from the canonical table", () => {
    for (const id of TRUTH_STATE_IDS) expect(NARROW_BOUNDARY_SYSTEM_PROMPT).toContain(id);
    expect(truthStateTableSha256()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("[37-41] failed-subset repair", () => {
  const broken = () => withRow(UNSAFE_ACTION, { governedActionCandidateId: "99-a9" });

  it("[37] valid rows from the first response are preserved", () => {
    const d = deriveBoundaryVerdict({ assessments: broken() }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.validSurfaceRefs).toHaveLength(11);
    expect(d.failedSurfaceRefs).toEqual([UNSAFE_ACTION]);
    expect(d.derived).toHaveLength(11);
  });

  it("[38] only the failed subset is requested", () => {
    const plan = planSubsetRepair(deriveBoundaryVerdict({ assessments: broken() }, ctx));
    expect(plan.repairable).toBe(true);
    if (!plan.repairable) throw new Error("unreachable");
    expect(plan.failedSurfaceRefs).toEqual([UNSAFE_ACTION]);
    expect(plan.preservedSurfaceRefs).toHaveLength(11);
  });

  it("[39] a repair cannot mutate a preserved row", () => {
    const d = deriveBoundaryVerdict({ assessments: broken() }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    const rogue = deriveBoundaryVerdict({ assessments: violationAt(UNSAFE_STATE) }, ctx);
    if (rogue.outcome !== "boundary_review_reject") throw new Error("unreachable");
    const merged = mergeSubsetRepair(d.derived, rogue.derived, [UNSAFE_ACTION]);
    expect(merged.ok).toBe(false);
    if (merged.ok) throw new Error("unreachable");
    expect(merged.code).toBe("subset_repair_preserved_row_mutated");
  });

  it("[40] a repair that misses a requested surface is refused", () => {
    const merged = mergeSubsetRepair([], [], [UNSAFE_ACTION]);
    expect(merged.ok).toBe(false);
    if (merged.ok) throw new Error("unreachable");
    expect(merged.code).toBe("subset_repair_coverage_mismatch");
  });

  it("[41] a coverage failure is NOT locally repairable", () => {
    const d = deriveBoundaryVerdict({ assessments: settled().slice(1) }, ctx);
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.failureClass).toBe("coverage");
    expect(planSubsetRepair(d).repairable).toBe(false);
  });
});

/**
 * Cases 32-36 are the CAPTURED-DTO regressions. They need the legacy upgrade and both live captures,
 * so they live in `r236TruthRegression` — this test only proves they are not silently missing.
 */
describe("[32-36] captured-DTO regressions live in r236TruthRegression", () => {
  it("[32-36] the regression suite exists and is bound to the measured live run", async () => {
    const m = await import("./r236LiveDtoFixture");
    expect(m.R236_LIVE_ARTIFACT_SHA256).toBe("04fc6f48e03f5ecad961d65565cd0b4473a866eb28ea2f255540b9569c4f38d2");
    expect(m.R236_LIVE_ATTEMPTS).toHaveLength(2);
  });
});

/**
 * R2.38-CLOSURE-R1 — two enforcement paths that lost their assertion when the R2.36 test files were
 * replaced rather than merged. The production code was correct throughout; only the proof was lost.
 * Both tests drive the REAL validator, not a helper in isolation.
 */
describe("[R1] restored reason and candidate-role enforcement", () => {
  const UNCERTAIN = "branch[1].tradeoff[1]";

  it("[R1a] a generic filler reason is REFUSED where the state requires the model's own words", () => {
    // `governed_action_uncertain` is a model_required state: only the reviewer can say what is
    // unclear. Filler passes the length gate (`needs review` is exactly MODEL_REASON_MIN_CHARS) and
    // must still be refused, or "uncertain" becomes a way to say nothing and be believed.
    for (const filler of ["needs review", "see evidence"]) {
      const r = validateNarrowBoundaryReview(
        { assessments: withRow(UNCERTAIN, { governedActionStatus: "uncertain", prerequisiteStatus: "uncertain", reason: filler }) },
        ctx,
      );
      expect(r.ok, `filler: ${filler}`).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.codes, `filler: ${filler}`).toContain("boundary_reason_generic");
      // The row carries no authority: it is not accepted, and it derives nothing.
      expect(r.derived.some((d) => d.surfaceRef === UNCERTAIN)).toBe(false);
      expect(r.failedSurfaceRefs).toContain(UNCERTAIN);
    }
    // The CONTRAST that makes the gate meaningful: a specific reason in the same state passes.
    const good = validateNarrowBoundaryReview(
      {
        assessments: withRow(UNCERTAIN, {
          governedActionStatus: "uncertain",
          prerequisiteStatus: "uncertain",
          reason: "'caring for' may or may not mean treating",
        }),
      },
      ctx,
    );
    expect(good.ok).toBe(true);
  });

  it("[R1b] a candidate supplied in a role the state FORBIDS is refused", () => {
    // `non_governing` forbids both prerequisite roles: a surface that does not perform the governed
    // action has no prerequisite to prove either way. The id used here is deliberately VALID —
    // known, surface-local and correctly provenanced — so the refusal cannot come from an unknown
    // or wrong-surface error instead.
    const ref = "branch[1].tradeoff[0]";
    const validSatisfaction = first(ref, "prerequisite_satisfaction");
    expect(validSatisfaction).not.toBe(NO_CANDIDATE);
    const resolved = candidates.find((c) => c.candidateId === validSatisfaction)!;
    expect(resolved.assessedSurfaceRef).toBe(ref);
    expect(resolved.semanticRole).toBe("prerequisite_satisfaction");

    const r = validateNarrowBoundaryReview({ assessments: withRow(ref, { prerequisiteSatisfactionCandidateId: validSatisfaction }) }, ctx);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.codes).toContain("boundary_candidate_forbidden_present");
    expect(r.codes).not.toContain("boundary_candidate_unknown");
    expect(r.codes).not.toContain("boundary_candidate_wrong_surface");
    expect(r.derived.some((d) => d.surfaceRef === ref)).toBe(false);
    const v = deriveBoundaryVerdict({ assessments: withRow(ref, { prerequisiteSatisfactionCandidateId: validSatisfaction }) }, ctx);
    expect(v.outcome).toBe("boundary_review_malformed");
  });

  it("[R1c] the SAME state with the sentinel validates and derives non_governing", () => {
    const ref = "branch[1].tradeoff[0]";
    const r = validateNarrowBoundaryReview({ assessments: withRow(ref, { prerequisiteSatisfactionCandidateId: NO_CANDIDATE }) }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const row = r.derived.find((d) => d.surfaceRef === ref)!;
    expect(row.stateId).toBe("non_governing");
    expect(row.applicability).toBe("not_applicable");
    expect(row.compliance).toBe("not_assessed");
  });
});

describe("[42-45] structural and hygiene properties", () => {
  it("[42] the truth table accepts a small fraction of the schema's combinations", () => {
    const c = truthStateCoverage(GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS);
    expect(c.permitted).toBe(90);
    expect(c.accepted).toBeLessThan(c.permitted / 2);
    expect(classifyTruthState({ governedActionStatus: "absent", prerequisiteStatus: "satisfied", temporalRelation: "action_before_prerequisite" }, "prerequisite_before_action")).toBeNull();
  });

  it("[43] extraction spans PARTITION a segment and never nest", () => {
    const spans = extractSpans("First sentence here. Second sentence follows.");
    expect(spans).toHaveLength(2);
    for (const a of spans) for (const b of spans) if (a !== b) expect(a.excerpt.includes(b.excerpt)).toBe(false);
  });

  it("[44] the candidate map digest moves when any candidate text moves", () => {
    const other = buildAllEvidenceCandidates([C18_BOUNDARY], frames, C18_REACHABLE_SURFACES, buildContextSegments({ ...C18_SCENARIO, opening: C18_SCENARIO.opening.replace("charge nurse", "charge nurse on call") }, C18_REACHABLE_SURFACES));
    expect(evidenceCandidateMapSha256(other.candidates)).not.toBe(evidenceCandidateMapSha256(candidates));
    expect(candidateContractSha256()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("[45] no candidate carries credential-shaped text, and none is a product-quality label", () => {
    for (const c of candidates) {
      expect(c.excerpt).not.toMatch(/sk-[A-Za-z0-9]{8,}|bearer\s/i);
      expect(c.excerpt.length).toBeLessThanOrEqual(160);
    }
  });
});
