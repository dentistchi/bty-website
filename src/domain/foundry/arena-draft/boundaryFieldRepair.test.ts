/**
 * FIELD-LEVEL PATCH REPAIR AUTHORITY (Slice 3.2I-R5B1A.1-R2.50).
 *
 * The negative cases come first and are the point of the file. A repair that accepts more than it
 * was asked for is worse than no repair: R2.48 measured a whole-row re-ask re-opening a field the
 * model had already answered correctly, and the "improvement" cost the run its verdict.
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_REPAIR_CODES,
  FIELD_REPAIR_JSON_SCHEMA,
  FIELD_REPAIR_VALUE_AUTHORITIES,
  REPAIRABLE_BOUNDARY_FIELDS,
  IDENTITY_FIELDS,
  applyFieldRepair,
  planFieldRepair,
  validateFieldRepairResponse,
  mergeFieldRepair,
  fieldRepairContractSha256,
  summarizeFieldRepair,
  type FieldRepairPlan,
} from "./boundaryFieldRepair";
import { groupAlternativesSha256 } from "./boundaryGroupAlternatives";
import { selectPlanDerivedResponse } from "./groupAlternativeSelection.fixture";
import { TRUTH_STATES } from "./boundaryTruthStates";
import { deriveBoundaryVerdict, validateNarrowBoundaryReview, type BoundaryTruthAssessment } from "./narrowBoundaryReview";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import {
  R248_ATTEMPT_1,
  R248_WHOLE_ROW_REPAIR,
  R248_ATTEMPT_1_VALID,
  R248_ATTEMPT_1_REQUIRED_MISSING,
  R248_ATTEMPT_1_PREREQUISITE_GROUP,
  R248_WHOLE_ROW_FORBIDDEN_PRESENT,
  R248_MEASURED,
} from "./r248LiveDtoFixture";

// ---------------------------------------------------------------------------
// The frozen c18 world
// ---------------------------------------------------------------------------

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
const CTX = {
  boundaries: [C18_BOUNDARY],
  surfaces: subject.surfaces,
  frames: buildSemanticFrames([C18_BOUNDARY]),
  candidates: subject.evidenceCandidates,
} as never;

const DIGESTS = {
  boundaryReviewSubjectSha256: subject.evidenceCandidateMapSha256,
  surfaceMapSha256: subject.surfaceMapSha256,
  lineageSha256: subject.lineageSha256,
};

const plan = (): FieldRepairPlan => planFieldRepair(R248_ATTEMPT_1, CTX, DIGESTS);

const op = (surfaceRef: string, field: string, value: string) => ({ surfaceRef, field, value });

/**
 * The exact operation set the plan asks for, answered correctly.
 *
 * R2.54 — PLAN-DERIVED. A grouped target has no scalar list to read a value from any more, so the
 * answer is assembled from ONE canonical alternative the plan itself generated. `allowedValues[0]`
 * would now silently produce `undefined` for `reason` and an arbitrary tuple for the rest.
 */
const correctOps = (p: FieldRepairPlan) => selectPlanDerivedResponse(p.targets).repairs;

/**
 * R2.59 — the whole RESPONSE the plan asks for: scalar repairs plus one selection per group.
 *
 * The grouped fields are deliberately absent from `repairs`. A test that wants to prove a grouped
 * field cannot be answered as a scalar builds that case explicitly.
 */
const correctResponse = (p: FieldRepairPlan) => selectPlanDerivedResponse(p.targets);
const groupIdOf = (p: FieldRepairPlan) => p.targets.find((t) => t.valueAuthority === "canonical_group_alternative")!.groupId;
const altIdOf = (p: FieldRepairPlan, stateId: string) =>
  p.targets.find((t) => t.valueAuthority === "canonical_group_alternative")!.alternatives.find((a) => a.stateId === stateId)!.alternativeId;

/** The one multi-field group in the captured evidence, and the fields R2.54 requires of it. */
const PREREQUISITE_GROUP_FIELDS = [
  "prerequisiteFailureCandidateId",
  "prerequisiteSatisfactionCandidateId",
  "prerequisiteStatus",
  "reason",
  "temporalRelation",
];
const groupOn = (p: FieldRepairPlan, surfaceRef: string) => p.targets.filter((t) => t.surfaceRef === surfaceRef);

/** Scalar-only helper: the group is answered correctly unless a case overrides it. */
const validate = (ops: unknown, p: FieldRepairPlan = plan(), d = DIGESTS) =>
  validateFieldRepairResponse({ repairs: ops, groupSelections: correctResponse(p).groupSelections }, p, CTX, d);
const validateResponse = (r: unknown, p: FieldRepairPlan = plan(), d = DIGESTS) => validateFieldRepairResponse(r, p, CTX, d);
const codesOf = (r: ReturnType<typeof validateFieldRepairResponse>) => (r.ok ? [] : r.codes);

// ---------------------------------------------------------------------------
// Part 9 — NEGATIVE PATCH REGRESSIONS (written first)
// ---------------------------------------------------------------------------

describe("[R2.50][9] the patch authority fails closed on everything it did not ask for", () => {
  it("9.1 a MISSING operation is refused", () => {
    const p = plan();
    const r = validate(correctOps(p).slice(1), p);
    expect(codesOf(r)).toContain("field_repair_operation_missing");
    expect(r.ok).toBe(false);
  });

  it("9.2 a DUPLICATE surface/field operation is refused", () => {
    const p = plan();
    const ops = correctOps(p);
    const r = validate([...ops, ops[0]!], p);
    expect(codesOf(r)).toContain("field_repair_operation_duplicate");
  });

  it("9.3 an EXTRA operation is refused, never silently discarded", () => {
    const p = plan();
    const r = validate([...correctOps(p), op("primary[0]", "governedActionCandidateId", "none")], p);
    expect(codesOf(r)).toContain("field_repair_surface_untargeted");
    expect(r.ok).toBe(false);
  });

  it("9.4 an UNTARGETED surface is refused — a preserved row is not repairable", () => {
    const p = plan();
    expect(p.frozenSurfaceRefs).toContain("branch[1].resulting_world_state");
    const r = validate([...correctOps(p), op("branch[1].resulting_world_state", "governedActionCandidateId", "8-a1")], p);
    expect(codesOf(r)).toContain("field_repair_surface_untargeted");
  });

  it("9.5 an UNTARGETED field on a targeted surface is refused", () => {
    const p = plan();
    const r = validate([...correctOps(p), op("primary[1]", "temporalRelation", "unrelated")], p);
    expect(codesOf(r)).toContain("field_repair_field_untargeted");
  });

  it("9.6 a boundaryId repair attempt is refused", () => {
    const p = plan();
    const r = validate([...correctOps(p), op("primary[1]", "boundaryId", "c9_other")], p);
    expect(codesOf(r)).toContain("field_repair_identity_field");
  });

  it("9.7 a surfaceRef repair attempt is refused", () => {
    const p = plan();
    const r = validate([...correctOps(p), op("primary[1]", "surfaceRef", "primary[0]")], p);
    expect(codesOf(r)).toContain("field_repair_identity_field");
    expect(IDENTITY_FIELDS).toEqual(["boundaryId", "surfaceRef"]);
  });

  it("9.8 a WRONG-ROLE candidate is refused", () => {
    const p = plan();
    const ops = correctOps(p).map((o) => (o.surfaceRef === "primary[1]" ? op(o.surfaceRef, o.field, "2-f1") : o));
    const r = validate(ops, p);
    expect(codesOf(r).some((c) => c === "field_repair_candidate_wrong_role" || c === "field_repair_candidate_not_in_menu")).toBe(true);
  });

  it("9.9 a WRONG-SURFACE candidate is refused", () => {
    const p = plan();
    const ops = correctOps(p).map((o) => (o.surfaceRef === "primary[1]" ? op(o.surfaceRef, o.field, "4-a1") : o));
    const r = validate(ops, p);
    expect(codesOf(r).some((c) => c === "field_repair_candidate_wrong_surface" || c === "field_repair_candidate_not_in_menu")).toBe(true);
  });

  it("9.10 an UNKNOWN candidate is refused", () => {
    const p = plan();
    const ops = correctOps(p).map((o) => (o.surfaceRef === "primary[1]" ? op(o.surfaceRef, o.field, "99-z9") : o));
    expect(codesOf(validate(ops, p)).some((c) => c === "field_repair_candidate_unknown" || c === "field_repair_candidate_not_in_menu")).toBe(true);
  });

  it("9.11 a candidate REMOVED by the R2.44 polarity authority is refused", () => {
    // 3-f1..7-f1 were removed when the polarity gate emptied branch[0]'s failure pools. They are not
    // restored to make a repair succeed.
    const all = new Set((subject.evidenceCandidates as Array<{ candidateId: string }>).map((c) => c.candidateId));
    for (const removed of ["3-f1", "4-f1", "5-f1", "6-f1", "7-f1"]) expect(all.has(removed), removed).toBe(false);
    // R2.59 — the removed ids are still absent from every pool, and a grouped candidate field can no
    // longer be answered as a scalar at all, so the attempt is refused twice over.
    const p = plan();
    const r = validate([...correctOps(p), op("branch[0].resulting_world_state", "prerequisiteFailureCandidateId", "3-f1")], p);
    expect(r.ok).toBe(false);
    expect(codesOf(r)).toContain("field_repair_grouped_field_in_repairs");
  });

  /**
   * 9.12 — R2.59 makes a partial group UNSAYABLE rather than merely refused.
   *
   * The group is one answer now, so there is no way to supply four fifths of it. Omitting the
   * selection is the closest expressible defect, and it is named as a response-completeness failure
   * rather than as a scalar operation gap.
   */
  it("9.12 an UNANSWERED dependency group is refused", () => {
    const p = plan();
    const group = p.targets.filter((t) => t.surfaceRef === "branch[0].resulting_world_state");
    expect(group.length).toBeGreaterThan(1);
    const r = validateResponse({ repairs: correctResponse(p).repairs, groupSelections: [] }, p);
    expect(codesOf(r)).toContain("field_repair_group_selection_missing");
    expect(r.ok).toBe(false);
  });

  it("9.13 a STALE base-row digest is refused at merge", () => {
    const p = plan();
    const mutated = R248_ATTEMPT_1.map((r) => (r.surfaceRef === "primary[1]" ? { ...r, reason: "tampered" } : r));
    const m = mergeFieldRepair(mutated, validate(correctOps(p), p), p, CTX);
    expect(m.ok).toBe(false);
    expect(m.codes).toContain("field_repair_base_row_digest_mismatch");
  });

  it("9.14 a STALE repair-plan digest is refused", () => {
    const p = plan();
    const r = validateFieldRepairResponse({ repairs: correctOps(p) }, { ...p, planSha256: "0".repeat(64) }, CTX, DIGESTS);
    expect(codesOf(r)).toContain("field_repair_plan_digest_mismatch");
  });

  it("9.15 a changed SUBJECT digest is refused", () => {
    const p = plan();
    expect(codesOf(validate(correctOps(p), p, { ...DIGESTS, boundaryReviewSubjectSha256: "9".repeat(64) }))).toContain("field_repair_subject_digest_mismatch");
  });

  it("9.16 a changed LINEAGE digest is refused", () => {
    const p = plan();
    expect(codesOf(validate(correctOps(p), p, { ...DIGESTS, lineageSha256: "9".repeat(64) }))).toContain("field_repair_lineage_digest_mismatch");
  });

  it("9.17 a changed SURFACE-MAP digest is refused", () => {
    const p = plan();
    expect(codesOf(validate(correctOps(p), p, { ...DIGESTS, surfaceMapSha256: "9".repeat(64) }))).toContain("field_repair_surface_map_digest_mismatch");
  });

  it("9.18 a FULL ROW returned instead of a patch is refused", () => {
    const p = plan();
    const r = validateFieldRepairResponse({ assessments: R248_WHOLE_ROW_REPAIR }, p, CTX, DIGESTS);
    expect(codesOf(r)).toContain("field_repair_not_a_patch");
    const r2 = validateFieldRepairResponse({ repairs: R248_WHOLE_ROW_REPAIR }, p, CTX, DIGESTS);
    expect(r2.ok).toBe(false);
  });

  it("9.19 a FROZEN semantic status supplied as an operation is refused", () => {
    // branch[1].action[1]'s `absent` was contract-valid in attempt 1. It is frozen.
    const p = plan();
    const r = validate([...correctOps(p), op("branch[1].action[1]", "governedActionStatus", "present")], p);
    expect(codesOf(r)).toContain("field_repair_field_untargeted");
  });

  /**
   * 9.20 — the same input R2.50 wrote this case for, refused EARLIER and by NAME.
   *
   * `satisfied` while citing no satisfaction candidate is not a canonical shape: the satisfied state
   * REQUIRES satisfaction evidence, so no alternative offers `none` there. Under R2.50 the group
   * passed its per-field menus and the CANONICAL ROW VALIDATOR caught it after the merge — a semantic
   * verdict standing in for a contract refusal. Under R2.54 the repair-group boundary refuses it, and
   * the merge is never attempted.
   */
  /**
   * 9.20 — R2.59 removes the whole class this case guarded.
   *
   * "Passes its menu but is no canonical shape" required the provider to author the tuple. It cannot
   * any more: it names an alternative, and the server writes the values. The nearest expressible
   * defect is naming an alternative that does not exist, and it must still stop before the merge.
   */
  it("9.20 an alternative the plan never offered is refused BEFORE merge", () => {
    const p = plan();
    const response = { repairs: correctResponse(p).repairs, groupSelections: [{ groupId: groupIdOf(p), alternativeId: "0".repeat(16), reason: "" }] };
    const v = validateResponse(response, p);
    expect(v.ok).toBe(false);
    expect(codesOf(v)).toContain("field_repair_group_selection_unknown_alternative");

    const applied = applyFieldRepair(response, R248_ATTEMPT_1, p, CTX, DIGESTS);
    expect(applied.mergeAttempted).toBe(false);
    expect(applied.merge.ok).toBe(false);
    expect(applied.merge.rows).toEqual([]);
    expect(applied.merge.codes).toContain("field_repair_group_selection_unknown_alternative");
    expect(applied.merge.codes).not.toContain("field_repair_merged_row_invalid");
  });

  it("every emitted code is registered — no ad-hoc strings", () => {
    const p = plan();
    const samples = [
      validate(correctOps(p).slice(1), p),
      validate([...correctOps(p), op("primary[0]", "governedActionCandidateId", "none")], p),
      validate([...correctOps(p), op("primary[1]", "boundaryId", "x")], p),
    ];
    for (const s of samples) for (const c of codesOf(s)) expect(FIELD_REPAIR_CODES).toContain(c);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — the dependency graph, derived from the truth-state table
// ---------------------------------------------------------------------------

describe("[R2.50][2] the repair dependency graph", () => {
  it("identity fields are never repairable", () => {
    for (const f of IDENTITY_FIELDS) expect(REPAIRABLE_BOUNDARY_FIELDS).not.toContain(f);
  });

  it("A — a missing governed-action candidate is a CANDIDATE-ONLY repair", () => {
    const p = plan();
    for (const ref of R248_ATTEMPT_1_REQUIRED_MISSING) {
      const t = p.targets.filter((x) => x.surfaceRef === ref);
      expect(t, ref).toHaveLength(1);
      expect(t[0]!.field, ref).toBe("governedActionCandidateId");
      expect(t[0]!.groupFields, ref).toEqual(["governedActionCandidateId"]);
    }
  });

  /**
   * B — THE DEPENDENCY GROUP IS ALL AND ONLY THE GOVERNED PREREQUISITE REPAIR FIELDS.
   *
   * Asserted as a set equality in both directions, so a field silently gained OR silently dropped
   * fails. `reason` is a member because a prerequisite-status change moves its AUTHORITY, which is
   * the fact R2.53 measured the absence of: a canonically valid tuple refused solely because the
   * frozen empty reason was illegal in the state the tuple selected.
   */
  it("B — the prerequisite group is exactly the five governed prerequisite repair fields", () => {
    const p = plan();
    const g = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]);
    expect(g.map((t) => t.field).sort()).toEqual(PREREQUISITE_GROUP_FIELDS);
    // The same set, seen from the group's own declaration rather than from the target list.
    for (const t of g) expect([...t.groupFields].sort()).toEqual(PREREQUISITE_GROUP_FIELDS);
    // `reason`'s membership is DERIVED: two states sharing a governed-action status disagree about
    // reasonAuthority, which is why the closure has to move it.
    const present = TRUTH_STATES.filter((s) => s.governedActionStatus === "present");
    expect(new Set(present.map((s) => s.reasonAuthority)).size).toBeGreaterThan(1);
  });

  /** F — THE GOVERNED-ACTION AXIS STAYS FROZEN OUTSIDE THE PREREQUISITE GROUP. */
  it("F — the governed-action fields are never pulled into a prerequisite group", () => {
    const p = plan();
    const g = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]);
    expect(g.map((t) => t.field)).not.toContain("governedActionStatus");
    expect(g.map((t) => t.field)).not.toContain("governedActionCandidateId");
    // Frozen means CARRIED AS CONTEXT, not merely absent: every member still shows the row's own
    // governed-action values so the model can stay consistent without resending them.
    for (const t of g) {
      expect(Object.keys(t.frozenContext)).toContain("governedActionStatus");
      expect(Object.keys(t.frozenContext)).toContain("governedActionCandidateId");
      expect(t.frozenContext.governedActionStatus).toBe("present");
    }
    // And no alternative offered to the group may move that axis.
    for (const alt of g[0]!.alternatives) {
      expect(TRUTH_STATES.find((s) => s.id === alt.stateId)?.governedActionStatus, alt.alternativeId).toBe("present");
    }
  });

  /** E — REASON AUTHORITY COMES FROM THE ALTERNATIVES, NOT FROM A SCALAR LIST. */
  it("E — `reason` publishes no scalar domain; its authority rides on the alternatives", () => {
    const p = plan();
    const reason = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]).find((t) => t.field === "reason")!;
    expect(reason.allowedValues).toEqual([]);
    expect(reason.valueAuthority).toBe("canonical_group_alternative");
    // Every alternative names an authority, and both authorities are actually offered here — so a
    // scalar list could not have expressed the rule even if one existed.
    const modes = new Set(reason.alternatives.map((a) => a.reasonConstraint));
    expect(modes.has("must_be_empty")).toBe(true);
    expect(modes.has("model_required")).toBe(true);
  });

  /** G — THE GROUP IS ONE ATOMIC UNIT: one id, one authority, one alternatives set. */
  it("G — the whole group is one atomic repair unit", () => {
    const p = plan();
    const g = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]);
    expect(new Set(g.map((t) => t.groupId)).size).toBe(1);
    expect(new Set(g.map((t) => t.valueAuthority))).toEqual(new Set(["canonical_group_alternative"]));
    expect(new Set(g.map((t) => t.alternativesSha256)).size).toBe(1);
    expect(new Set(g.map((t) => t.authorityCode)).size).toBe(1);
    // Same alternatives object content on every member — one shape, published once.
    for (const t of g) expect(groupAlternativesSha256(t.alternatives)).toBe(g[0]!.alternativesSha256);
  });

  it("a standalone target keeps its scalar domain — the two authorities are distinct and both used", () => {
    const p = plan();
    const standalone = p.targets.filter((t) => t.groupFields.length === 1);
    expect(standalone.length).toBeGreaterThan(0);
    for (const t of standalone) {
      expect(t.valueAuthority).toBe("scalar_allowed_values");
      expect(t.allowedValues.length).toBeGreaterThan(0);
      expect(t.alternatives).toEqual([]);
    }
    expect(new Set(p.targets.map((t) => t.valueAuthority))).toEqual(new Set(FIELD_REPAIR_VALUE_AUTHORITIES));
  });

  it("every target carries its authority code, reason, value authority and frozen context", () => {
    for (const t of plan().targets) {
      expect(t.authorityCode.length).toBeGreaterThan(0);
      expect(t.reason.length).toBeGreaterThan(0);
      expect(FIELD_REPAIR_VALUE_AUTHORITIES).toContain(t.valueAuthority);
      // A target has a value authority; it does NOT necessarily have a value LIST.
      if (t.valueAuthority === "scalar_allowed_values") expect(t.allowedValues.length).toBeGreaterThan(0);
      else expect(t.alternatives.length).toBeGreaterThan(0);
      expect(Object.keys(t.frozenContext).length).toBeGreaterThan(0);
      if (t.field.endsWith("CandidateId")) expect(t.candidateMenu).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Parts 3 + 8 — schema shape and the captured R2.48 result
// ---------------------------------------------------------------------------

describe("[R2.50][3] the patch schema uses only strict-supported constructs", () => {
  it("no oneOf, if/then or discriminated union anywhere", () => {
    const s = JSON.stringify(FIELD_REPAIR_JSON_SCHEMA);
    for (const banned of ["oneOf", "allOf", '"if"', '"then"', '"not"', "dependentRequired", "patternProperties"]) {
      expect(s, banned).not.toContain(banned);
    }
  });

  it("every operation property is required and additionalProperties is closed", () => {
    const items = FIELD_REPAIR_JSON_SCHEMA.properties.repairs.items;
    expect(items.additionalProperties).toBe(false);
    expect([...items.required].sort()).toEqual(["field", "surfaceRef", "value"]);
    expect(FIELD_REPAIR_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("the response carries no assessment rows, and exactly two answer arrays", () => {
    expect(JSON.stringify(FIELD_REPAIR_JSON_SCHEMA)).not.toContain("assessments");
    // R2.59 — one array per authority: scalars the provider authors, selections it copies.
    expect(Object.keys(FIELD_REPAIR_JSON_SCHEMA.properties)).toEqual(["repairs", "groupSelections"]);
    expect([...FIELD_REPAIR_JSON_SCHEMA.required].sort()).toEqual(["groupSelections", "repairs"]);
    // A grouped field cannot even be NAMED in a scalar repair.
    expect(FIELD_REPAIR_JSON_SCHEMA.properties.repairs.items.properties.field.enum).not.toContain("prerequisiteStatus");
    expect(FIELD_REPAIR_JSON_SCHEMA.properties.repairs.items.properties.field.enum).not.toContain("reason");
  });
});

describe("[R2.50][8] the captured R2.48 evidence", () => {
  it("A — the historical WHOLE-ROW repair still fails exactly as it did", () => {
    const repairCtx = {
      ...(CTX as object),
      surfaces: subject.surfaces.filter((s) => R248_WHOLE_ROW_REPAIR.some((r) => r.surfaceRef === s.coordinate)),
    } as never;
    const d = deriveBoundaryVerdict({ assessments: R248_WHOLE_ROW_REPAIR }, repairCtx);
    expect(d.outcome).toBe("boundary_review_malformed");
    if (d.outcome !== "boundary_review_malformed") throw new Error("unreachable");
    expect(d.findings.filter((f) => f.code === "boundary_candidate_forbidden_present").map((f) => f.surfaceRef).sort()).toEqual(
      [...R248_WHOLE_ROW_FORBIDDEN_PRESENT].sort(),
    );
    expect(R248_MEASURED.scenarioUnjudged).toBe(true);
  });

  it("A — attempt 1 still yields 2 valid and 10 failed, with branch[0].rws carrying two codes", () => {
    const v = validateNarrowBoundaryReview({ assessments: R248_ATTEMPT_1 }, CTX);
    expect(v.ok).toBe(false);
    if (v.ok) throw new Error("unreachable");
    expect(v.validSurfaceRefs.sort()).toEqual([...R248_ATTEMPT_1_VALID].sort());
    expect(v.failedSurfaceRefs).toHaveLength(10);
    const rws = v.findings.filter((f) => f.surfaceRef === "branch[0].resulting_world_state").map((f) => f.code).sort();
    expect(rws).toEqual(["boundary_candidate_wrong_role", "boundary_prerequisite_failure_candidate_unavailable"]);
  });

  it("B — the plan targets exactly the failed surfaces and freezes the valid ones", () => {
    const p = plan();
    expect(p.repairable).toBe(true);
    expect([...new Set(p.targets.map((t) => t.surfaceRef))].sort()).toEqual(
      [...R248_ATTEMPT_1_REQUIRED_MISSING, ...R248_ATTEMPT_1_PREREQUISITE_GROUP].sort(),
    );
    expect(p.frozenSurfaceRefs.sort()).toEqual([...R248_ATTEMPT_1_VALID].sort());

    /**
     * A — THE OPERATION COUNT IS EXACTLY 14, AND IT IS A SUM, NOT A LITERAL.
     *
     * 9 candidate-only repairs + one FIVE-field prerequisite group. The count is asserted against
     * its own decomposition so that a change in either part cannot be absorbed by the other: R2.49
     * measured 13 changed fields on the intended corrected matrix, and R2.54 adds exactly one — the
     * `reason` whose authority moves with the prerequisite status.
     */
    const standalone = p.targets.filter((t) => t.groupFields.length === 1);
    const grouped = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]);
    expect(standalone).toHaveLength(9);
    expect(grouped).toHaveLength(5);
    expect(p.requiredOperationCount).toBe(standalone.length + grouped.length);
    expect(p.requiredOperationCount).toBe(14);
    expect(p.targets).toHaveLength(14);
    // The captured R2.49 measurement is NOT rewritten to match. It measured 13; the fourteenth
    // operation is what R2.54 adds, and the difference is exactly the reason target.
    expect(R248_MEASURED.r249IntendedChangedFields).toBe(13);
    expect(p.requiredOperationCount - R248_MEASURED.r249IntendedChangedFields).toBe(1);
    expect(grouped.map((t) => t.field)).toContain("reason");
    expect(p.dependencyGroupCount).toBe(10);
  });

  /**
   * C + D — THE GROUP CARRIES REAL ALTERNATIVES, AND THE DIGEST IS OVER THOSE ALTERNATIVES.
   *
   * D is asserted against the repository's own hashing contract — `groupAlternativesSha256` recomputed
   * from the published set — rather than against a snapshotted string. A snapshot would still match if
   * the generator and the digest drifted together, which is precisely the shape of the R2.48 defect.
   */
  it("C,D — the group publishes non-empty canonical alternatives under a digest that binds them", () => {
    const p = plan();
    const g = groupOn(p, R248_ATTEMPT_1_PREREQUISITE_GROUP[0]);
    const first = g[0]!;

    expect(first.alternatives.length).toBeGreaterThan(0);
    expect(first.alternativesSha256).toHaveLength(64);
    expect(first.alternativesSha256).toBe(groupAlternativesSha256(first.alternatives));
    // The digest is a function OF the alternatives: perturb the set and it must move.
    expect(groupAlternativesSha256(first.alternatives.slice(1))).not.toBe(first.alternativesSha256);
    // Every alternative is complete — a shape, not a fragment.
    for (const a of first.alternatives) {
      expect(a.alternativeId.length).toBeGreaterThan(0);
      expect(TRUTH_STATES.map((s) => s.id)).toContain(a.stateId);
      expect(a.prerequisiteStatus.length).toBeGreaterThan(0);
      expect(a.temporalDomain.length).toBeGreaterThan(0);
      expect(a.satisfactionCandidateDomain.length).toBeGreaterThan(0);
      expect(a.failureCandidateDomain.length).toBeGreaterThan(0);
    }
    // And the alternatives are bound into the PLAN digest, so shapes cannot move under a plan the
    // model was already asked against.
    const drifted: FieldRepairPlan = {
      ...p,
      targets: p.targets.map((t) => (t.groupId === first.groupId ? { ...t, alternativesSha256: "0".repeat(64) } : t)),
    };
    expect(codesOf(validateFieldRepairResponse({ repairs: correctOps(p) }, drifted, CTX, DIGESTS))).toContain("field_repair_plan_digest_mismatch");
  });

  it("C — the deterministic patch response produces a COMPLETE twelve-surface matrix", () => {
    const p = plan();
    const ops = [
      ...R248_ATTEMPT_1_REQUIRED_MISSING.map((ref) => {
        const t = p.targets.find((x) => x.surfaceRef === ref)!;
        return op(ref, "governedActionCandidateId", t.candidateMenu![0]!.candidateId);
      }),
    ];
    /**
     * R2.59 — the group is SELECTED, not rebuilt. `satisfied` is a server-derived alternative, so
     * the one legal `reason` is the canonical empty string; the four canonical values come from the
     * server, which is why they no longer appear here.
     */
    const v = validateResponse(
      { repairs: ops, groupSelections: [{ groupId: groupIdOf(p), alternativeId: altIdOf(p, "governed_action_prerequisite_satisfied"), reason: "" }] },
      p,
    );
    expect(codesOf(v)).toEqual([]);
    expect(v.groupSelections).toHaveLength(1);
    expect(v.groupSelections[0]!.matchedStateId).toBe("governed_action_prerequisite_satisfied");
    expect(v.groupSelections[0]!.reasonAuthority).toBe("server_derived");
    // The five grouped operations were built by the SERVER, from the named alternative.
    expect(v.counts.providerScalarRepairCount).toBe(9);
    expect(v.counts.providerGroupSelectionCount).toBe(1);
    expect(v.counts.expandedCanonicalOperationCount).toBe(5);
    const m = mergeFieldRepair(R248_ATTEMPT_1, v, p, CTX);
    expect(m.codes).toEqual([]);
    expect(m.ok).toBe(true);
    if (!m.ok) throw new Error("unreachable");
    expect(m.rows).toHaveLength(12);
    expect(m.metrics.fieldRepairFrozenMutationCount).toBe(0);
    expect(m.metrics.fieldRepairMergedRowInvalidCount).toBe(0);

    const d = deriveBoundaryVerdict({ assessments: m.rows }, CTX);
    expect(d.outcome).toBe("boundary_review_reject");
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.assessedPairs).toBe(12);
    // primary[1]'s direct row is untouched by the repair beyond the one missing candidate.
    const p1 = d.derived.find((x) => x.surfaceRef === "primary[1]")!;
    expect(p1.facts.governedActionStatus).toBe("absent");
    expect(p1.governedAction?.candidateId).toBe("2-a1");
    expect(p1.applicability).toBe("not_applicable");
    expect(d.violations.map((v2) => v2.surfaceRef)).toEqual(["branch[1].resulting_world_state"]);
    expect(d.causalAttributions.map((a) => `${a.ancestorSurfaceRef}<-${a.manifestationSurfaceRef}`)).toEqual([
      "primary[1]<-branch[1].resulting_world_state",
    ]);
    expect(d.causalAttributionMetrics.ancestorDirectAssessmentMutationCount).toBe(0);
    expect(subject.evidenceCandidates).toHaveLength(57);
  });

  it("C — branch[1].action[1] follows its FROZEN attempt-1 status, not a human oracle", () => {
    const p = plan();
    const ops = correctOps(p);
    const m = mergeFieldRepair(R248_ATTEMPT_1, validate(ops, p), p, CTX);
    if (!m.ok) throw new Error("unreachable");
    const row = m.rows.find((r) => r.surfaceRef === "branch[1].action[1]")!;
    // Attempt 1 said `absent`. That was contract-valid, so it is frozen — even though R2.46 said
    // `present` and a human oracle prefers `present`. The repair supplied only the missing candidate.
    expect(row.governedActionStatus).toBe("absent");
    expect(row.governedActionCandidateId).toBe("12-a1");
    expect(row.prerequisiteFailureCandidateId).toBe("none");
    const d = deriveBoundaryVerdict({ assessments: m.rows }, CTX);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    // A complete semantic measurement, NOT a repair failure.
    expect(d.violations.map((v) => v.surfaceRef)).not.toContain("branch[1].action[1]");
  });
});

// ---------------------------------------------------------------------------
// Part 7 / D — the frozen true positive
// ---------------------------------------------------------------------------

describe("[R2.50][7] a valid field is frozen through an unrelated repair", () => {
  /** Attempt 1 as it would be had action[1] been judged `present`, as R2.46 judged it. */
  const withTruePositive: BoundaryTruthAssessment[] = R248_ATTEMPT_1.map((r) =>
    r.surfaceRef === "branch[1].action[1]"
      ? ({
          ...r,
          governedActionStatus: "present",
          prerequisiteStatus: "explicitly_missing",
          temporalRelation: "action_before_prerequisite",
          governedActionCandidateId: "12-a1",
          prerequisiteFailureCandidateId: "12-f1",
        } as BoundaryTruthAssessment)
      : r,
  );

  it("the complete valid row is frozen and never targeted", () => {
    const p = planFieldRepair(withTruePositive, CTX, DIGESTS);
    expect(p.frozenSurfaceRefs).toContain("branch[1].action[1]");
    expect(p.targets.map((t) => t.surfaceRef)).not.toContain("branch[1].action[1]");
  });

  it("it survives an unrelated repair byte-identically, and BOTH correction concepts remain", () => {
    const p = planFieldRepair(withTruePositive, CTX, DIGESTS);
    const ops = [
      ...p.targets.filter((t) => t.field === "governedActionCandidateId").map((t) => op(t.surfaceRef, t.field, t.candidateMenu![0]!.candidateId)),
    ];
    const v = validateFieldRepairResponse(
      { repairs: ops, groupSelections: [{ groupId: groupIdOf(p), alternativeId: altIdOf(p, "governed_action_prerequisite_satisfied"), reason: "" }] },
      p,
      CTX,
      DIGESTS,
    );
    expect(codesOf(v)).toEqual([]);
    const m = mergeFieldRepair(withTruePositive, v, p, CTX);
    if (!m.ok) throw new Error("unreachable");
    const before = withTruePositive.find((r) => r.surfaceRef === "branch[1].action[1]")!;
    const after = m.rows.find((r) => r.surfaceRef === "branch[1].action[1]")!;
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(m.metrics.fieldRepairFrozenMutationCount).toBe(0);

    const d = deriveBoundaryVerdict({ assessments: m.rows }, CTX);
    if (d.outcome !== "boundary_review_reject") throw new Error("unreachable");
    expect(d.violations.map((x) => x.surfaceRef)).toEqual(["branch[1].resulting_world_state", "branch[1].action[1]"]);
    expect(d.causalGroups.map((g) => [g.correctionOwnerSurfaceRef, ...g.manifestationSurfaceRefs].join("+"))).toEqual([
      "primary[1]+branch[1].resulting_world_state",
      "branch[1].action[1]",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Part 10 — observability
// ---------------------------------------------------------------------------

describe("[R2.50][10] the counters an auditor reads", () => {
  it("plan and merge counters reconcile on the captured evidence", () => {
    const p = plan();
    const v = validate(correctOps(p), p);
    const m = mergeFieldRepair(R248_ATTEMPT_1, v, p, CTX);
    const s = summarizeFieldRepair(p, v, m);
    expect(s.fieldRepairSurfaceCount).toBe(10);
    // 9 standalone + one five-field prerequisite group across 10 dependency groups.
    expect(s.fieldRepairOperationCount).toBe(14);
    expect(s.fieldRepairDependencyGroupCount).toBe(10);
    expect(s.fieldRepairMissingOperationCount).toBe(0);
    expect(s.fieldRepairDuplicateOperationCount).toBe(0);
    expect(s.fieldRepairUntargetedOperationCount).toBe(0);
    expect(s.fieldRepairFrozenMutationCount).toBe(0);
    expect(s.fieldRepairMergedRowInvalidCount).toBe(0);
  });

  it("the contract digest is stable", () => {
    expect(fieldRepairContractSha256()).toBe(fieldRepairContractSha256());
    expect(fieldRepairContractSha256()).toHaveLength(64);
  });
});
