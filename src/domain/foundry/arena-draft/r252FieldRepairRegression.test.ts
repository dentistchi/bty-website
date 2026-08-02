/**
 * CAPTURED R2.52 FIELD-REPAIR REGRESSIONS — CASES A–G (Slice 3.2I-R5B1A.1-R2.54 Part 4).
 *
 * Every case here runs on a payload the repository CAPTURED, not on one this file constructed:
 *
 *   A  the captured attempt-1 rows                     `R248_ATTEMPT_1`     (byte-identical in the
 *                                                                           R2.52 live artifact)
 *   B  the captured 13-operation live patch            `R252_CAPTURED_PATCH`
 *   C  the captured group selection + the frozen ""    `R252_CAPTURED_GROUP_SELECTION`
 *   D  a MIX of two alternatives the plan offers      halves of two real canonical shapes
 *   E  a server-derived alternative the plan generated
 *   F  a model-required alternative the plan generated
 *   G  the captured whole-row repair DTO               `R248_WHOLE_ROW_REPAIR`
 *
 * TWO THINGS ARE PROVEN FOR EVERY CASE: the validation/match outcome, and whether the MERGE BOUNDARY
 * was crossed. The second is the point. R2.52's live patch was clean at every patch-layer counter —
 * complete, unduplicated, untargeted-free, zero frozen mutations — crossed into the merge, and lost
 * the run its verdict to `boundary_reason_required_missing` from the canonical row validator. A
 * refusal that arrives after the merge is a semantic verdict standing in for a contract refusal.
 *
 * The refusal CODES are asserted precisely, because they are the thing an auditor reads. An
 * INCOMPLETE group is a completeness failure — `field_repair_operation_missing`,
 * `field_repair_dependency_group_partial`, `field_repair_operation_count_mismatch` — and reporting it
 * as `field_repair_group_shape_not_allowed` would misdescribe what the model actually did.
 */

import { describe, it, expect } from "vitest";
import {
  applyFieldRepair,
  fieldRepairObservability,
  planFieldRepair,
  type FieldRepairPlan,
  type FieldRepairTarget,
} from "./boundaryFieldRepair";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { buildFieldRepairRequest, buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import { R248_ATTEMPT_1, R248_WHOLE_ROW_REPAIR } from "./r248LiveDtoFixture";
import {
  R252_CAPTURED_GROUP_SELECTION,
  R252_CAPTURED_PATCH,
  R252_DEFECTIVE_GROUP_SURFACE_REF,
  R252_FROZEN_REASON,
  R252_MEASURED,
  R252_SELECTED_STATE_ID,
  R252_SELECTED_STATE_REASON_AUTHORITY,
} from "./r252LiveDtoFixture";
import { capturedR252GroupOperations, modelReasonFor, selectPlanDerivedOperations, selectPlanDerivedResponse } from "./groupAlternativeSelection.fixture";

// ---------------------------------------------------------------------------
// The frozen c18 world the captured run was measured against
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
const defectiveGroup = (p: FieldRepairPlan): FieldRepairTarget[] => p.targets.filter((t) => t.surfaceRef === R252_DEFECTIVE_GROUP_SURFACE_REF);

/**
 * Run one case through the LIVE seam — the same function `boundaryReviewStage` calls.
 *
 * `mergeAttempted` is read off the seam, not inferred from an empty row list, so "merge was never
 * called" is a measurement rather than a reading.
 */
/** R2.59 — a group is answered by selection. `groupSelections` defaults to the correct one. */
const selectionsFor = (p: FieldRepairPlan, stateId = "governed_action_prerequisite_satisfied", reason?: string) => {
  const first = p.targets.find((t) => t.valueAuthority === "canonical_group_alternative")!;
  const alt = first.alternatives.find((a) => a.stateId === stateId)!;
  return [{ groupId: first.groupId, alternativeId: alt.alternativeId, reason: reason ?? (alt.reasonConstraint === "model_required" ? modelReasonFor(alt.stateId) : "") }];
};
const run = (repairs: unknown, p: FieldRepairPlan = plan(), groupSelections: unknown = selectionsFor(p)) => {
  const applied = applyFieldRepair({ repairs, groupSelections }, R248_ATTEMPT_1, p, CTX, DIGESTS);
  return {
    plan: p,
    ...applied,
    codes: applied.validation.ok ? [] : applied.validation.codes,
    observability: fieldRepairObservability(p, applied),
  };
};

/** The full 14-operation patch with the defective group answered by `selection`. */
const withGroupSelection = (p: FieldRepairPlan, selection: Record<string, string>) =>
  selectPlanDerivedOperations(p.targets, (group) =>
    group.map((t) => {
      const value = selection[t.field];
      if (value === undefined) throw new Error(`case setup supplied no value for grouped field ${t.field}`);
      return { surfaceRef: t.surfaceRef, field: t.field, value };
    }),
  );

// ---------------------------------------------------------------------------
// A — the captured base still produces the plan R2.54 describes
// ---------------------------------------------------------------------------

describe("[R2.54][4] CASE A — the captured attempt-1 rows", () => {
  it("still plan to 14 operations across 10 groups, with a FIVE-field prerequisite group", () => {
    const p = plan();
    expect(p.repairable).toBe(true);
    expect(p.requiredOperationCount).toBe(14);
    expect(p.dependencyGroupCount).toBe(10);
    const g = defectiveGroup(p);
    expect(g.map((t) => t.field).sort()).toEqual([
      "prerequisiteFailureCandidateId",
      "prerequisiteSatisfactionCandidateId",
      "prerequisiteStatus",
      "reason",
      "temporalRelation",
    ]);
    // The R2.52 run planned THIRTEEN against this identical base. The difference is the whole slice.
    expect(R252_MEASURED.fieldRepairMetrics.fieldRepairOperationCount).toBe(13);
    expect(p.requiredOperationCount - R252_MEASURED.fieldRepairMetrics.fieldRepairOperationCount).toBe(1);
  });

  it("offer the state the live model chose — it was never an unavailable shape", () => {
    // The R2.53 failure was NOT "the model picked something illegal". The state is canonical and IS
    // offered; what was missing was any way to satisfy the reason authority it carries.
    const alts = defectiveGroup(plan())[0]!.alternatives;
    const chosen = alts.find((a) => a.stateId === R252_SELECTED_STATE_ID);
    expect(chosen, R252_SELECTED_STATE_ID).toBeDefined();
    expect(chosen!.reasonAuthority).toBe(R252_SELECTED_STATE_REASON_AUTHORITY);
    expect(chosen!.reasonConstraint).toBe("model_required");
    expect(chosen!.temporalDomain).toContain(R252_CAPTURED_GROUP_SELECTION.temporalRelation);
  });
});

// ---------------------------------------------------------------------------
// B — the historical 13-operation patch against the 14-operation plan
// ---------------------------------------------------------------------------

describe("[R2.54][4] CASE B — the captured 13-operation live patch", () => {
  /**
   * R2.59 — the captured patch is refused for a DIFFERENT and earlier reason now.
   *
   * It answered the group as four scalar operations, which is the representation this slice removed.
   * The artifact is untouched; what changed is that the shape it used is no longer sayable. Both the
   * grouped-scalar attempt and the absent selection are named, so an auditor sees exactly which
   * contract it predates.
   */
  it("is refused because its GROUPED-SCALAR representation no longer exists", () => {
    const r = run([...R252_CAPTURED_PATCH], plan(), []);
    expect(R252_CAPTURED_PATCH).toHaveLength(13);
    expect(r.validation.ok).toBe(false);
    expect(r.codes).toContain("field_repair_grouped_field_in_repairs");
    expect(r.codes).toContain("field_repair_group_selection_missing");
    // Still not a shape or reason verdict: it never reached the alternative at all.
    expect(r.codes).not.toContain("field_repair_group_shape_not_allowed");
    expect(r.codes).not.toContain("field_repair_group_reason_required_missing");
  });

  it("names the one missing operation: the reason whose authority the group moves", () => {
    const p = plan();
    const supplied = new Set(R252_CAPTURED_PATCH.map((o) => `${o.surfaceRef} ${o.field}`));
    const missing = p.targets.filter((t) => !supplied.has(`${t.surfaceRef} ${t.field}`));
    expect(missing).toHaveLength(1);
    expect(missing[0]!.field).toBe("reason");
    expect(missing[0]!.surfaceRef).toBe(R252_DEFECTIVE_GROUP_SURFACE_REF);
  });

  it("never reaches the merge — the boundary R2.52 crossed", () => {
    const r = run([...R252_CAPTURED_PATCH], plan(), []);
    expect(R252_MEASURED.reachedMergeBoundary).toBe(true); // what the live run did
    expect(r.mergeAttempted).toBe(false); // what it does now
    expect(r.merge.ok).toBe(false);
    expect(r.merge.rows).toEqual([]);
    expect(r.merge.codes).not.toContain("field_repair_merged_row_invalid");
  });
});

// ---------------------------------------------------------------------------
// C — the exact R2.53 live failure selection
// ---------------------------------------------------------------------------

describe("[R2.54][4] CASE C — the exact R2.53 failure selection, completed to 14 operations", () => {
  /**
   * R2.59 — the same SEMANTIC choice, in the only representation that now exists: the
   * `not_established` alternative named by id, with the frozen empty reason the live model sent.
   */
  const capturedRun = () => {
    const p = plan();
    return run(selectPlanDerivedResponse(p.targets).repairs, p, selectionsFor(p, R252_SELECTED_STATE_ID, R252_FROZEN_REASON));
  };

  it("supplies the captured tuple verbatim, including the frozen empty reason", () => {
    // The captured scalar tuple is retained verbatim as historical evidence.
    const ops = capturedR252GroupOperations(defectiveGroup(plan()));
    const byField = Object.fromEntries(ops.map((o) => [o.field, o.value]));
    expect(byField.prerequisiteStatus).toBe("not_established");
    expect(byField.temporalRelation).toBe("not_applicable");
    expect(byField.prerequisiteSatisfactionCandidateId).toBe("none");
    expect(byField.prerequisiteFailureCandidateId).toBe("none");
    expect(byField.reason).toBe(R252_FROZEN_REASON);
    // R2.59 — and the selection that expresses the same state carries the same empty reason.
    expect(selectionsFor(plan(), R252_SELECTED_STATE_ID, R252_FROZEN_REASON)[0]!.reason).toBe("");
  });

  it("is refused with the precise reason code — selected, canonical, and still illegal", () => {
    const r = capturedRun();
    expect(r.validation.ok).toBe(false);
    expect(r.codes).toEqual(["field_repair_group_reason_required_missing"]);
    // NOT a completeness failure: the group WAS answered, and the selection names a real alternative.
    expect(r.codes).not.toContain("field_repair_operation_missing");
    expect(r.codes).not.toContain("field_repair_group_selection_missing");
    expect(r.codes).not.toContain("field_repair_operation_count_mismatch");
    expect(r.codes).not.toContain("field_repair_group_shape_not_allowed");
    expect(r.validation.counts.providerGroupSelectionCount).toBe(1);
  });

  it("is stopped at the REPAIR-GROUP boundary, not by the canonical row validator after merge", () => {
    const r = capturedRun();
    expect(r.mergeAttempted).toBe(false);
    expect(r.merge.rows).toEqual([]);
    // R2.52 reported this same input as `field_repair_merged_row_invalid`, downstream of the merge,
    // with `boundary_reason_required_missing` underneath. Both are now unreachable for this input.
    expect(R252_MEASURED.fieldRepairCodes).toEqual(["field_repair_merged_row_invalid"]);
    expect(R252_MEASURED.mergedRowRefusalCode).toBe("boundary_reason_required_missing");
    expect(r.merge.codes).not.toContain("field_repair_merged_row_invalid");
    expect(r.merge.metrics.fieldRepairMergedRowInvalidCount).toBe(0);
  });

  it("records WHY, in the artifact, without disclosing prose", () => {
    const o = capturedRun().observability;
    expect(o.groups).toHaveLength(1);
    const g = o.groups[0]!;
    // R2.59 — the selection RESOLVED to a real alternative and was then refused on its reason
    // authority, so the artifact names the alternative AND the refusal. That is more informative
    // than the old "matched: false", which could not say which shape had been chosen.
    expect(g.matchedAlternativeId).toBe("b0e54cfa5c730e41");
    expect(g.matchedStateId).toBe(R252_SELECTED_STATE_ID);
    expect(g.refusalCode).toBe("field_repair_group_reason_required_missing");
    expect(g.reasonAuthority).toBe("model_required");
    // R2.59 — the artifact records the id the provider COPIED, even when the selection is refused.
    expect(g.requestedAlternativeId).toBe("b0e54cfa5c730e41");
    expect(g.expansionSource).toBeNull();
    expect(g.selected.reason).toBe("<empty>");
    expect(o.mergeAttempted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D — a COMPLETE group whose values form no canonical alternative
// ---------------------------------------------------------------------------

/**
 * R2.59 — MIXING IS NO LONGER SAYABLE.
 *
 * The old case built a tuple from halves of two offered alternatives. A provider cannot do that any
 * more: it names ONE alternative and the server writes every value. The case is kept because the
 * property it guarded still matters — a group answer that does not correspond to an offered
 * alternative must be refused before merge — and the expressible form of that is naming an
 * alternative this group was never offered.
 */
const foreignAlternativeId = (p: FieldRepairPlan): string => {
  const first = defectiveGroup(p)[0]!;
  const mine = new Set(first.alternatives.map((a) => a.alternativeId));
  const other = p.targets.flatMap((t) => t.alternatives).find((a) => !mine.has(a.alternativeId));
  // c18 has exactly one multi-field group, so no genuinely foreign id exists here; an id nobody
  // issued is the honest stand-in, and it is refused by its own distinct code.
  return other?.alternativeId ?? "f".repeat(16);
};

describe("[R2.54][4] CASE D — a group answer that is no offered alternative", () => {
  it("mixing two alternatives is now STRUCTURALLY impossible, not merely refused", () => {
    const p = plan();
    const first = defectiveGroup(p)[0]!;
    // There is no field in the RESPONSE where a second alternative's value could go, and the
    // request publishes no scalar list for a grouped target to draw one from.
    expect(first.valueAuthority).toBe("canonical_group_alternative");
    expect(buildFieldRepairRequest(subject, p).scalarTargets.map((t) => t.field)).not.toContain("prerequisiteStatus");
    const response = { repairs: selectPlanDerivedResponse(p.targets).repairs, groupSelections: selectionsFor(p) };
    expect(JSON.stringify(response.groupSelections)).not.toContain("prerequisiteStatus");
    expect(JSON.stringify(response.repairs)).not.toContain("prerequisiteStatus");
  });

  it("an alternative the group was never offered is refused", () => {
    const p = plan();
    const r = run(selectPlanDerivedResponse(p.targets).repairs, p, [{ groupId: defectiveGroup(p)[0]!.groupId, alternativeId: foreignAlternativeId(p), reason: "" }]);
    expect(r.validation.ok).toBe(false);
    expect(r.codes).toContain("field_repair_group_selection_unknown_alternative");
    expect(r.codes).not.toContain("field_repair_operation_missing");
  });

  it("never reaches the merge", () => {
    const p = plan();
    const r = run(selectPlanDerivedResponse(p.targets).repairs, p, [{ groupId: defectiveGroup(p)[0]!.groupId, alternativeId: foreignAlternativeId(p), reason: "" }]);
    expect(r.mergeAttempted).toBe(false);
    expect(r.merge.rows).toEqual([]);
    expect(r.observability.groups[0]!.matchedAlternativeId).toBeNull();
    expect(r.observability.groups[0]!.refusalCode).toBe("field_repair_group_selection_unknown_alternative");
  });
});

describe("[R2.54][4] CASE E — a valid server-derived alternative", () => {
  const accepted = () => {
    const p = plan();
    return run(selectPlanDerivedResponse(p.targets).repairs, p); // defaults to the satisfied state
  };

  it("matches `governed_action_prerequisite_satisfied` and ACCEPTS the empty reason", () => {
    const r = accepted();
    expect(r.codes).toEqual([]);
    expect(r.validation.ok).toBe(true);
    expect(r.validation.groupSelections).toHaveLength(1);
    const sel = r.validation.groupSelections[0]!;
    expect(sel.matchedStateId).toBe("governed_action_prerequisite_satisfied");
    expect(sel.matchedAlternativeId).not.toBeNull();
    expect(sel.reasonAuthority).toBe("server_derived");
    // The empty reason is not tolerated here — it is REQUIRED. Server-derived states forbid prose.
    expect(sel.selected.reason).toBe("");
  });

  it("crosses the merge and produces the complete twelve-surface matrix", () => {
    const r = accepted();
    expect(r.plan.requiredOperationCount).toBe(14);
    // 9 provider scalars + 5 server-expanded = the canonical 14.
    expect(r.validation.counts.providerScalarRepairCount).toBe(9);
    expect(r.validation.counts.expandedCanonicalOperationCount).toBe(5);
    expect(r.validation.operations).toHaveLength(14);
    expect(r.mergeAttempted).toBe(true);
    expect(r.merge.ok).toBe(true);
    if (!r.merge.ok) throw new Error("unreachable");
    expect(r.merge.rows).toHaveLength(12);
    expect(r.merge.metrics.fieldRepairFrozenMutationCount).toBe(0);
    expect(r.merge.metrics.fieldRepairMergedRowInvalidCount).toBe(0);
    expect(r.observability.mergeAttempted).toBe(true);
    expect(r.observability.mergeAccepted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F — a valid MODEL-REQUIRED alternative
// ---------------------------------------------------------------------------

describe("[R2.54][4] CASE F — a valid model-required alternative", () => {
  const accepted = () => {
    const p = plan();
    return run(selectPlanDerivedResponse(p.targets).repairs, p, selectionsFor(p, R252_SELECTED_STATE_ID));
  };

  it("is the SAME state R2.53 was refused for — differing only in the reason it can now supply", () => {
    const p = plan();
    const sel = selectionsFor(p, R252_SELECTED_STATE_ID)[0]!;
    const alt = defectiveGroup(p)[0]!.alternatives.find((a) => a.alternativeId === sel.alternativeId)!;
    expect(alt.prerequisiteStatus).toBe(R252_CAPTURED_GROUP_SELECTION.prerequisiteStatus);
    expect(alt.reasonConstraint).toBe("model_required");
    expect(sel.reason.trim().length).toBeGreaterThan(0);
  });

  it("matches `governed_action_prerequisite_not_established` and is accepted", () => {
    const r = accepted();
    expect(r.codes).toEqual([]);
    const sel = r.validation.groupSelections[0]!;
    expect(sel.matchedStateId).toBe("governed_action_prerequisite_not_established");
    expect(sel.reasonAuthority).toBe("model_required");
  });

  it("crosses the merge and produces the complete matrix", () => {
    const r = accepted();
    expect(r.validation.operations).toHaveLength(14);
    expect(r.mergeAttempted).toBe(true);
    expect(r.merge.ok).toBe(true);
    if (!r.merge.ok) throw new Error("unreachable");
    expect(r.merge.rows).toHaveLength(12);
    expect(r.merge.metrics.fieldRepairFrozenMutationCount).toBe(0);
    // The prose is in the merged row, and NOT in the artifact.
    const row = r.merge.rows.find((x) => x.surfaceRef === R252_DEFECTIVE_GROUP_SURFACE_REF)!;
    expect(row.reason.trim().length).toBeGreaterThan(0);
    expect(r.observability.groups[0]!.selected.reason).toMatch(/^<model-prose:\d+:[0-9a-f]{12}>$/);
    expect(JSON.stringify(r.observability)).not.toContain(row.reason);
  });
});

// ---------------------------------------------------------------------------
// G — the captured WHOLE-ROW repair, returned where a patch was asked for
// ---------------------------------------------------------------------------

describe("[R2.54][4] CASE G — the captured R2.48 whole-row repair DTO", () => {
  it("is refused as not a patch, under both response shapes", () => {
    const asRepairs = run([...R248_WHOLE_ROW_REPAIR]);
    expect(asRepairs.validation.ok).toBe(false);
    expect(asRepairs.codes).toContain("field_repair_not_a_patch");

    const p = plan();
    const asAssessments = applyFieldRepair({ assessments: R248_WHOLE_ROW_REPAIR }, R248_ATTEMPT_1, p, CTX, DIGESTS);
    expect(asAssessments.validation.ok).toBe(false);
    expect(asAssessments.validation.ok ? [] : asAssessments.validation.codes).toContain("field_repair_not_a_patch");
  });

  it("never reaches the merge under either shape", () => {
    expect(run([...R248_WHOLE_ROW_REPAIR]).mergeAttempted).toBe(false);
    const p = plan();
    expect(applyFieldRepair({ assessments: R248_WHOLE_ROW_REPAIR }, R248_ATTEMPT_1, p, CTX, DIGESTS).mergeAttempted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The invariant across all seven
// ---------------------------------------------------------------------------

describe("[R2.54][4] no refused case reaches the merge", () => {
  it("every refusal in the matrix stops before the merge, and every acceptance crosses it", () => {
    const p = plan();
    const good = selectPlanDerivedResponse(p.targets).repairs;
    const cases: Array<[string, unknown, unknown]> = [
      ["B captured 13-op patch", [...R252_CAPTURED_PATCH], []],
      ["C exact R2.53 selection", good, selectionsFor(p, R252_SELECTED_STATE_ID, R252_FROZEN_REASON)],
      ["D unoffered alternative", good, [{ groupId: defectiveGroup(p)[0]!.groupId, alternativeId: foreignAlternativeId(p), reason: "" }]],
      ["G whole-row DTO", [...R248_WHOLE_ROW_REPAIR], []],
    ];
    for (const [label, repairs, groupSelections] of cases) {
      const r = run(repairs, p, groupSelections);
      expect(r.validation.ok, label).toBe(false);
      expect(r.mergeAttempted, label).toBe(false);
      expect(r.merge.rows, label).toEqual([]);
      expect(r.observability.mergeAttempted, label).toBe(false);
    }
    const ok = run(good, p);
    expect(ok.validation.ok).toBe(true);
    expect(ok.mergeAttempted).toBe(true);
  });
});
