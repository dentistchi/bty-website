/**
 * GROUP-SELECTION RESPONSE AUTHORITY (Slice 3.2I-R5B1A.1-R2.59).
 *
 * R2.57 spent the one authorized live replay. R2.58 measured what came back and found something more
 * useful than a failure: the provider returned all fourteen planned operations, answered the
 * dependency group completely, and picked four values belonging to EXACTLY ONE canonical
 * alternative. It then sent `reason: ""` — explicitly, not omitted — and the run was safely refused.
 *
 * Replacing only that one field with valid prose made the same response validate, match
 * `b0e54cfa5c730e41`, cross the merge and produce the complete twelve-row matrix. The live failure
 * was one field wide.
 *
 * The defect was the RESPONSE SHAPE. The prompt said "choose exactly one alternative"; the schema
 * made the model rebuild five scalars by hand. Four of them were copyable from the alternative it
 * had chosen; the fifth had to be authored, and it was the one that came back empty.
 *
 * R2.59 removes the mismatch: a group is answered by `{groupId, alternativeId, reason}`, the server
 * resolves the id and writes the four canonical values, and `reason` is the only thing the provider
 * authors. This file keeps the decisive R2.58 finding executable, and proves the new authority has
 * exactly one door.
 *
 * ZERO NETWORK. Every case reads the saved live response; nothing here can call a provider.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIELD_REPAIR_OBSERVABILITY_VERSION,
  STANDALONE_REPAIRABLE_FIELDS,
  applyFieldRepair,
  fieldRepairObservability,
  planFieldRepair,
  type FieldRepairPlan,
} from "./boundaryFieldRepair";
import { buildFieldRepairRequest, buildNarrowBoundarySubject } from "@/lib/bty/foundry/arena/narrowBoundaryContract";
import { buildSemanticFrames } from "./boundarySemanticFrame";
import { C18_BOUNDARY, C18_SURFACES, C18_SCENARIO, C18_SCENARIO_SHA256 } from "./c18BoundaryFixture";
import { selectPlanDerivedResponse } from "./groupAlternativeSelection.fixture";

// ---------------------------------------------------------------------------
// The saved live evidence. Read-only, and never rewritten.
// ---------------------------------------------------------------------------

const ARTIFACT = join(
  process.cwd(),
  ".eval-artifacts",
  "practice-review.boundaryreplay.live.20260802T151505Z.pass2.c18-constrained-clinical.a2.3b87d68bb972.json",
);
/** The R2.57 live artifact is untracked working evidence: degrade to a stated skip, never a silent pass. */
const saved = (): { attempt1: never[]; patch: Array<{ surfaceRef: string; field: string; value: string }> } | null => {
  try {
    const b = JSON.parse(readFileSync(ARTIFACT, "utf8")) as { boundaryReviewEvidence: Array<{ parsed: Record<string, never[]> }> };
    return { attempt1: b.boundaryReviewEvidence[0]!.parsed.assessments, patch: b.boundaryReviewEvidence[1]!.parsed.repairs as never };
  } catch {
    return null;
  }
};

/** What R2.58 measured, restated here so a drift in the evidence is visible rather than absorbed. */
const R257 = {
  suppliedOperations: 14,
  groupSurfaceRef: "branch[0].resulting_world_state",
  groupId: "158644920b4e034a",
  alternativeId: "b0e54cfa5c730e41",
  stateId: "governed_action_prerequisite_not_established",
  reasonWasExplicitEmptyString: true,
} as const;

const VALID_PROSE = "the world state never says whether either identifier was checked before treatment";

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

const planFromLive = (): FieldRepairPlan | null => {
  const s = saved();
  return s ? planFieldRepair(s.attempt1, CTX, DIGESTS) : null;
};
const groupOf = (p: FieldRepairPlan) => p.targets.find((t) => t.valueAuthority === "canonical_group_alternative")!;
const run = (p: FieldRepairPlan, response: unknown) => {
  const s = saved()!;
  const applied = applyFieldRepair(response, s.attempt1, p, CTX, DIGESTS);
  return { ...applied, codes: applied.validation.ok ? [] : applied.validation.codes, observability: fieldRepairObservability(p, applied) };
};
const scalars = (p: FieldRepairPlan) => selectPlanDerivedResponse(p.targets).repairs;
const select = (p: FieldRepairPlan, over: Partial<{ groupId: string; alternativeId: string; reason: string }> = {}) => [
  { groupId: groupOf(p).groupId, alternativeId: R257.alternativeId, reason: VALID_PROSE, ...over },
];

// ---------------------------------------------------------------------------
// Part 8 — the saved live response, in three forms
// ---------------------------------------------------------------------------

describe("[R2.59][8] A — the historical R2.57 response no longer has a shape to be accepted in", () => {
  it("the saved response really did answer the group with five scalar operations", () => {
    const s = saved();
    if (!s) return expect(s).toBeNull();
    expect(s.patch).toHaveLength(R257.suppliedOperations);
    const grouped = s.patch.filter((o) => o.surfaceRef === R257.groupSurfaceRef);
    expect(grouped).toHaveLength(5);
    // The measurement that started this slice: `reason` was PRESENT and explicitly empty.
    const reason = grouped.find((o) => o.field === "reason")!;
    expect(Object.hasOwn(reason, "value")).toBe(R257.reasonWasExplicitEmptyString);
    expect(reason.value).toBe("");
  });

  it("replaying it verbatim is refused, and never reaches the merge", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const r = run(p, { repairs: saved()!.patch, groupSelections: [] });
    expect(r.validation.ok).toBe(false);
    // Refused for its REPRESENTATION now, one step before the reason authority it used to fail on.
    expect(r.codes).toContain("field_repair_grouped_field_in_repairs");
    expect(r.codes).toContain("field_repair_group_selection_missing");
    expect(r.mergeAttempted).toBe(false);
    expect(r.merge.rows).toEqual([]);
    expect(r.observability.mergeAttempted).toBe(false);
  });

  it("and the artifact it came from is still readable, byte for byte", () => {
    const s = saved();
    if (!s) return expect(s).toBeNull();
    const b = JSON.parse(readFileSync(ARTIFACT, "utf8")) as Record<string, unknown>;
    expect(b.artifactVersion).toBe("practice-narrow-boundary-replay/6");
    expect(b.boundaryProviderInvocationCount).toBe(2);
    expect(b.fieldRepairCodes).toEqual(["field_repair_group_reason_required_missing"]);
  });
});

describe("[R2.59][8] B — the same evidence, in the new shape, with the same empty reason", () => {
  it("is refused on the reason authority alone, and never reaches the merge", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const r = run(p, { repairs: scalars(p), groupSelections: select(p, { reason: "" }) });
    expect(r.validation.ok).toBe(false);
    // ONE code. The group was answered, the alternative resolved; only the prose was missing.
    expect(r.codes).toEqual(["field_repair_group_reason_required_missing"]);
    expect(r.mergeAttempted).toBe(false);
    expect(r.merge.rows).toEqual([]);
    const g = r.observability.groups[0]!;
    expect(g.requestedAlternativeId).toBe(R257.alternativeId);
    expect(g.matchedStateId).toBe(R257.stateId);
    expect(g.reasonAuthority).toBe("model_required");
    expect(g.expansionSource).toBeNull();
    expect(g.selected.reason).toBe("<empty>");
  });
});

describe("[R2.59][8] C — the same evidence with ONLY the reason changed", () => {
  const accepted = () => {
    const p = planFromLive()!;
    return { p, r: run(p, { repairs: scalars(p), groupSelections: select(p) }) };
  };

  it("the nine standalone repairs are preserved exactly as the live model sent them", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const live = new Map(saved()!.patch.filter((o) => o.surfaceRef !== R257.groupSurfaceRef).map((o) => [`${o.surfaceRef} ${o.field}`, o.value]));
    expect(live.size).toBe(9);
    for (const o of scalars(p)) expect(live.get(`${o.surfaceRef} ${o.field}`), `${o.surfaceRef} ${o.field}`).toBe(o.value);
  });

  it("is accepted, expands to five server-built operations, and merges to the complete matrix", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const { r } = accepted();
    expect(r.codes).toEqual([]);
    expect(r.validation.ok).toBe(true);

    // THE DECISIVE R2.58 FINDING, executable: one field was the whole difference.
    expect(r.validation.counts.providerScalarRepairCount).toBe(9);
    expect(r.validation.counts.providerGroupSelectionCount).toBe(1);
    expect(r.validation.counts.expandedCanonicalOperationCount).toBe(5);
    expect(r.validation.counts.canonicalOperationPlanCount).toBe(14);
    expect(r.validation.operations).toHaveLength(14);

    expect(r.validation.groupSelections[0]!.matchedStateId).toBe(R257.stateId);
    expect(r.mergeAttempted).toBe(true);
    expect(r.merge.ok).toBe(true);
    if (!r.merge.ok) throw new Error("unreachable");
    expect(r.merge.rows).toHaveLength(12);
    expect(r.merge.metrics.fieldRepairMergedRowInvalidCount).toBe(0);
    expect(r.merge.metrics.fieldRepairFrozenMutationCount).toBe(0);
    expect(r.observability.groups[0]!.expansionSource).toBe("canonical_alternative_expansion");
  });

  it("the four canonical values in the merged row came from the ALTERNATIVE, not the provider", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const { r } = accepted();
    if (!r.merge.ok) throw new Error("unreachable");
    const alt = groupOf(p).alternatives.find((a) => a.alternativeId === R257.alternativeId)!;
    const row = r.merge.rows.find((x) => x.surfaceRef === R257.groupSurfaceRef)!;
    expect(row.prerequisiteStatus).toBe(alt.prerequisiteStatus);
    expect(row.temporalRelation).toBe(alt.temporalDomain[0]);
    expect(row.prerequisiteSatisfactionCandidateId).toBe("none");
    expect(row.prerequisiteFailureCandidateId).toBe("none");
    // Only the prose is the model's.
    expect(row.reason).toBe(VALID_PROSE);
    // The governed-action axis stayed frozen throughout.
    expect(row.governedActionStatus).toBe("present");
    expect(row.governedActionCandidateId).toBe("3-a1");
  });
});

// ---------------------------------------------------------------------------
// Part 9 — one authority per group, proven by every way of breaking it
// ---------------------------------------------------------------------------

describe("[R2.59][9] the conflict and refusal matrix", () => {
  const p = () => planFromLive()!;
  const expectRefused = (label: string, response: unknown, code: string) => {
    const plan = p();
    const r = run(plan, response);
    expect(r.validation.ok, label).toBe(false);
    expect(r.codes, label).toContain(code);
    // Every refusal, without exception, stops before the merge and fabricates nothing.
    expect(r.mergeAttempted, label).toBe(false);
    expect(r.merge.ok, label).toBe(false);
    expect(r.merge.rows, label).toEqual([]);
    expect(r.merge.metrics.fieldRepairMergedRowInvalidCount, label).toBe(0);
    expect(JSON.stringify(r.merge), label).not.toContain("explicit_boundary_contradiction");
  };

  it("1 valid model_required selection + valid prose is ACCEPTED", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const r = run(plan, { repairs: scalars(plan), groupSelections: select(plan) });
    expect(r.codes).toEqual([]);
    expect(r.mergeAttempted).toBe(true);
  });

  it("2 valid server_derived selection + empty reason is ACCEPTED", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const satisfied = groupOf(plan).alternatives.find((a) => a.stateId === "governed_action_prerequisite_satisfied")!;
    const r = run(plan, { repairs: scalars(plan), groupSelections: select(plan, { alternativeId: satisfied.alternativeId, reason: "" }) });
    expect(r.codes).toEqual([]);
    expect(r.mergeAttempted).toBe(true);
    expect(r.validation.groupSelections[0]!.reasonAuthority).toBe("server_derived");
  });

  it("3 model_required + empty reason", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("3", { repairs: scalars(p()), groupSelections: select(p(), { reason: "" }) }, "field_repair_group_reason_required_missing");
  });

  it("4 model_required + whitespace reason", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("4", { repairs: scalars(p()), groupSelections: select(p(), { reason: "   \n\t " }) }, "field_repair_group_reason_required_missing");
  });

  it("5 model_required + too-short reason", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("5", { repairs: scalars(p()), groupSelections: select(p(), { reason: "too short" }) }, "field_repair_group_reason_required_missing");
  });

  it("6 model_required + generic reason", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    // A REGISTERED generic phrase, long enough to clear the minimum, so the generic rule is what
    // actually fires rather than the length rule.
    expectRefused("6", { repairs: scalars(p()), groupSelections: select(p(), { reason: "needs review" }) }, "field_repair_group_reason_invalid");
  });

  it("7 server_derived + prose where empty is required", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const satisfied = groupOf(p()).alternatives.find((a) => a.stateId === "governed_action_prerequisite_satisfied")!;
    expectRefused(
      "7",
      { repairs: scalars(p()), groupSelections: select(p(), { alternativeId: satisfied.alternativeId, reason: VALID_PROSE }) },
      "field_repair_group_reason_forbidden_present",
    );
  });

  it("8 unknown groupId", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("8", { repairs: scalars(p()), groupSelections: select(p(), { groupId: "z".repeat(16) }) }, "field_repair_group_selection_unknown_group");
  });

  it("9 unknown alternativeId", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("9", { repairs: scalars(p()), groupSelections: select(p(), { alternativeId: "z".repeat(16) }) }, "field_repair_group_selection_unknown_alternative");
  });

  it("11 duplicate group selection", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    expectRefused("11", { repairs: scalars(plan), groupSelections: [...select(plan), ...select(plan)] }, "field_repair_group_selection_duplicate");
  });

  it("12 missing group selection", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    expectRefused("12", { repairs: scalars(p()), groupSelections: [] }, "field_repair_group_selection_missing");
  });

  it("13 a scalar repair targets a grouped field", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const extra = { surfaceRef: R257.groupSurfaceRef, field: "prerequisiteStatus", value: "not_established" };
    expectRefused("13", { repairs: [...scalars(plan), extra], groupSelections: select(plan) }, "field_repair_grouped_field_in_repairs");
  });

  it("14 scalar and group selection conflict on the same field", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    // Even a value AGREEING with the selected alternative is refused: two authorities is the defect,
    // not disagreement between them.
    const alt = groupOf(plan).alternatives.find((a) => a.alternativeId === R257.alternativeId)!;
    const agreeing = { surfaceRef: R257.groupSurfaceRef, field: "prerequisiteStatus", value: alt.prerequisiteStatus };
    expectRefused("14", { repairs: [...scalars(plan), agreeing], groupSelections: select(plan) }, "field_repair_grouped_field_in_repairs");
  });

  it("16 a selection for a singleton (non-selectable) target", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const singleton = plan.targets.find((t) => t.valueAuthority === "scalar_allowed_values")!;
    expectRefused(
      "16",
      { repairs: scalars(plan), groupSelections: [...select(plan), { groupId: singleton.groupId, alternativeId: R257.alternativeId, reason: "" }] },
      "field_repair_group_selection_not_selectable",
    );
  });

  it("17 a frozen field mutated through repairs", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const frozen = { surfaceRef: "branch[1].resulting_world_state", field: "governedActionCandidateId", value: "8-a1" };
    expectRefused("17", { repairs: [...scalars(plan), frozen], groupSelections: select(plan) }, "field_repair_surface_untargeted");
  });

  it("18 a missing standalone scalar repair", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    expectRefused("18", { repairs: scalars(plan).slice(1), groupSelections: select(plan) }, "field_repair_operation_missing");
  });

  it("19 a duplicate standalone repair", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const ops = scalars(plan);
    expectRefused("19", { repairs: [...ops, ops[0]!], groupSelections: select(plan) }, "field_repair_operation_duplicate");
  });

  it("21 an alternative removed after the request was built", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const drifted: FieldRepairPlan = {
      ...plan,
      targets: plan.targets.map((t) =>
        t.valueAuthority === "canonical_group_alternative" ? { ...t, alternatives: t.alternatives.filter((a) => a.alternativeId !== R257.alternativeId) } : t,
      ),
    };
    /**
     * The alternatives no longer hash to the digest the plan published, so the group is refused as
     * DRIFTED before the selection is even looked up — the model answered a question that has since
     * changed underneath it.
     */
    const r = run(drifted, { repairs: scalars(plan), groupSelections: select(plan) });
    expect(r.validation.ok).toBe(false);
    expect(r.codes).toContain("field_repair_group_alternative_digest_mismatch");
    expect(r.mergeAttempted).toBe(false);
    expect(r.merge.rows).toEqual([]);
  });

  it("22 a stale plan digest", () => {
    if (!planFromLive()) return expect(planFromLive()).toBeNull();
    const plan = p();
    const r = run({ ...plan, planSha256: "0".repeat(64) }, { repairs: scalars(plan), groupSelections: select(plan) });
    expect(r.codes).toContain("field_repair_plan_digest_mismatch");
    expect(r.mergeAttempted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The structural claims the matrix rests on
// ---------------------------------------------------------------------------

describe("[R2.59][4] one authority per group, structurally", () => {
  it("a grouped field cannot even be NAMED in a scalar repair", () => {
    // The provider's own schema refuses it, before any server rule applies.
    expect([...STANDALONE_REPAIRABLE_FIELDS]).toEqual(["governedActionCandidateId", "prerequisiteSatisfactionCandidateId", "prerequisiteFailureCandidateId"]);
    expect([...STANDALONE_REPAIRABLE_FIELDS]).not.toContain("prerequisiteStatus");
    expect([...STANDALONE_REPAIRABLE_FIELDS]).not.toContain("temporalRelation");
    expect([...STANDALONE_REPAIRABLE_FIELDS]).not.toContain("reason");
  });

  it("every single-field target in the plan is one of those standalone fields", () => {
    const plan = planFromLive();
    if (!plan) return expect(plan).toBeNull();
    // The assumption `STANDALONE_REPAIRABLE_FIELDS` encodes, asserted rather than trusted.
    for (const t of plan.targets.filter((x) => x.valueAuthority === "scalar_allowed_values")) {
      expect([...STANDALONE_REPAIRABLE_FIELDS], t.field).toContain(t.field);
    }
  });

  it("the request publishes grouped fields ONLY as selectable alternatives", () => {
    const plan = planFromLive();
    if (!plan) return expect(plan).toBeNull();
    const req = buildFieldRepairRequest(subject, plan);
    expect(req.scalarTargets.every((t) => (STANDALONE_REPAIRABLE_FIELDS as readonly string[]).includes(t.field))).toBe(true);
    expect(req.requiredScalarRepairCount + req.dependencyGroups.reduce((n, g) => n + g.fields.length, 0)).toBe(req.requiredOperationCount);
    // And the diagnostic prose no longer shares a name with the repairable reason field.
    expect(req.scalarTargets.every((t) => typeof t.refusalExplanation === "string")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Part 11 — the retained artifact stays readable across the observability bump
// ---------------------------------------------------------------------------

describe("[R2.59][11] artifact backward compatibility", () => {
  it("the R2.57 artifact still parses, and declares the OBSERVABILITY version it was written under", () => {
    const s = saved();
    if (!s) return expect(s).toBeNull();
    const b = JSON.parse(readFileSync(ARTIFACT, "utf8")) as { artifactVersion: string; fieldRepairObservability: Record<string, unknown> };
    // The ARTIFACT's key set did not change, so its version did not move.
    expect(b.artifactVersion).toBe("practice-narrow-boundary-replay/6");
    const obs = b.fieldRepairObservability;
    /**
     * The record itself was written under `/1`. R2.59 added counters and provenance, so the
     * sub-version moved — and a reader can tell which shape it is holding without guessing.
     */
    expect(obs.version).toBe("practice-boundary-field-repair-observability/1");
    expect(obs.version).not.toBe(FIELD_REPAIR_OBSERVABILITY_VERSION);
    // Every field the `/1` reader relied on is still present and still means what it meant.
    for (const k of ["operationPlanCount", "dependencyGroupCount", "planSha256", "suppliedOperationCount", "accepted", "refusalCodes", "mergeAttempted", "mergeAccepted", "groups", "redaction"]) {
      expect(Object.hasOwn(obs, k), k).toBe(true);
    }
    expect(obs.mergeAttempted).toBe(false);
    expect(obs.refusalCodes).toEqual(["field_repair_group_reason_required_missing"]);
    // The R2.59 counters are absent from the historical record, and that is correct — not repaired.
    expect(Object.hasOwn(obs, "providerGroupSelectionCount")).toBe(false);
  });

  it("a NEW record carries the new version and the new counters", () => {
    const p = planFromLive();
    if (!p) return expect(p).toBeNull();
    const o = run(p, { repairs: scalars(p), groupSelections: select(p) }).observability;
    expect(o.version).toBe(FIELD_REPAIR_OBSERVABILITY_VERSION);
    expect(o.providerScalarRepairCount).toBe(9);
    expect(o.providerGroupSelectionCount).toBe(1);
    expect(o.expandedCanonicalOperationCount).toBe(5);
    expect(o.canonicalOperationPlanCount).toBe(14);
    expect(o.groups[0]!.expansionSource).toBe("canonical_alternative_expansion");
    // Privacy is unchanged: model prose is still a shape, never text.
    expect(o.groups[0]!.selected.reason).toMatch(/^<model-prose:\d+:[0-9a-f]{12}>$/);
    expect(JSON.stringify(o)).not.toContain(VALID_PROSE);
  });
});
