/**
 * FIELD-LEVEL PATCH REPAIR AUTHORITY (Slice 3.2I-R5B1A.1-R2.50).
 *
 * WHAT R2.49 MEASURED
 *
 * R2.48 rewrote the reviewer contract — removed the cross-role generalization, separated the two
 * candidate authorities, generated every per-state clause from the requirement table. The repair
 * response came back BYTE-IDENTICAL to R2.46's on all nine shared surfaces. The prompt was never the
 * operative variable.
 *
 * The operative variable is granularity. The repair re-asks whole SURFACES, so a row invalid in one
 * field is re-solved in all six. On four rows attempt 1 had already answered
 * `prerequisiteFailureCandidateId: "none"` correctly; only the governed-action candidate was
 * missing. Re-asking the row re-opened the correct field and the model filled it with a
 * `parent_generated_state` span carrying a TRUE inherited fact — and the state forbids it. The run
 * lost its verdict to an improvement.
 *
 * Attempt 1 needed 13 of 72 fields changed. Nine of the ten failed rows needed exactly ONE.
 *
 * WHAT THIS MODULE DOES
 *
 * The first response stays a complete full-row DTO. The one permitted repair carries only PATCH
 * OPERATIONS — `{surfaceRef, field, value}` — against a server-owned plan. A field the validator
 * accepted is not merely ignored if resent: it is not in the plan, so sending it is refused. Frozen
 * values are structurally ABSENT from the exchange rather than returned and discarded.
 *
 * The dependency closure is DERIVED from the canonical truth-state table, not hard-coded: a
 * candidate whose id is simply wrong is a one-field repair, while a prerequisite state the pool
 * cannot support pulls in every field whose requirement moves when that state moves.
 *
 * SEMANTIC IMMUTABILITY. A contract-valid field from attempt 1 is frozen even when a previous run or
 * a human oracle would choose differently. This module repairs output-contract defects, never
 * opinions.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import {
  CANDIDATE_FIELD_OF,
  GOVERNED_ACTION_STATUSES,
  IDENTITY_FIELDS,
  NO_CANDIDATE,
  PREREQUISITE_STATUSES,
  REPAIRABLE_BOUNDARY_FIELDS,
  TEMPORAL_RELATIONS,
  validateNarrowBoundaryReview,
  type BoundaryTruthAssessment,
  type GroundingFinding,
  type NarrowReviewContext,
  type RepairableBoundaryField,
} from "./narrowBoundaryReview";
import { TRUTH_STATES, type TruthStateRule } from "./boundaryTruthStates";
import { poolFor } from "./boundaryEvidenceCandidates";

export const FIELD_REPAIR_VERSION = "practice-boundary-field-repair/1";
export const FIELD_REPAIR_SCHEMA_NAME = "bty_practice_boundary_field_repair_v1";
export const MAX_FIELD_REPAIR_OPERATIONS = 96;
export const FIELD_REPAIR_VALUE_MAX = 32;

export { REPAIRABLE_BOUNDARY_FIELDS, IDENTITY_FIELDS };

export const FIELD_REPAIR_CODES = [
  "field_repair_not_a_patch",
  "field_repair_operation_missing",
  "field_repair_operation_duplicate",
  "field_repair_operation_extra",
  "field_repair_operation_count_mismatch",
  "field_repair_surface_untargeted",
  "field_repair_field_untargeted",
  "field_repair_identity_field",
  "field_repair_value_not_allowed",
  "field_repair_candidate_unknown",
  "field_repair_candidate_wrong_surface",
  "field_repair_candidate_wrong_role",
  "field_repair_candidate_not_in_menu",
  "field_repair_dependency_group_partial",
  "field_repair_base_row_digest_mismatch",
  "field_repair_plan_digest_mismatch",
  "field_repair_subject_digest_mismatch",
  "field_repair_lineage_digest_mismatch",
  "field_repair_surface_map_digest_mismatch",
  "field_repair_frozen_field_mutated",
  "field_repair_merged_row_invalid",
] as const;
export type FieldRepairCode = (typeof FIELD_REPAIR_CODES)[number];

// ---------------------------------------------------------------------------
// The patch DTO — strict-schema safe
// ---------------------------------------------------------------------------

export type BoundaryFieldRepairOperation = { surfaceRef: string; field: string; value: string };
export type BoundaryFieldRepairResponse = { repairs: BoundaryFieldRepairOperation[] };

/**
 * No `oneOf`, no `if/then`, no discriminated union — the provider adapter runs `strict: true` and
 * those constructs are exactly what a strict subset is least reliable about. Every property is
 * required and `additionalProperties` is closed. The VALUE domain is a plain string here; the exact
 * allowed set is enforced at runtime against the server-owned plan, which is the only authority.
 */
export const FIELD_REPAIR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    repairs: {
      type: "array",
      minItems: 1,
      maxItems: MAX_FIELD_REPAIR_OPERATIONS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          surfaceRef: { type: "string", maxLength: 32 },
          field: { type: "string", enum: [...REPAIRABLE_BOUNDARY_FIELDS] },
          value: { type: "string", maxLength: FIELD_REPAIR_VALUE_MAX },
        },
        required: ["surfaceRef", "field", "value"],
      },
    },
  },
  required: ["repairs"],
} as const;

// ---------------------------------------------------------------------------
// The dependency graph, derived from the canonical table
// ---------------------------------------------------------------------------

const FIELD_OF_STATE_AXIS: Record<"governedActionStatus" | "prerequisiteStatus" | "temporalRelation", RepairableBoundaryField> = {
  governedActionStatus: "governedActionStatus",
  prerequisiteStatus: "prerequisiteStatus",
  temporalRelation: "temporalRelation",
};

/**
 * Which fields' requirements move when the PREREQUISITE axis moves, measured from the table.
 *
 * Two states differing only in `prerequisiteStatus` can differ in their legal temporal relations and
 * in whether each candidate role is required or forbidden. Every such field must be re-answered
 * together or the row is internally inconsistent — which is precisely the partial-group failure this
 * module refuses.
 */
export function prerequisiteClosure(): RepairableBoundaryField[] {
  const fields = new Set<RepairableBoundaryField>([FIELD_OF_STATE_AXIS.prerequisiteStatus]);
  const byGoverned = new Map<string, TruthStateRule[]>();
  for (const s of TRUTH_STATES) byGoverned.set(s.governedActionStatus, [...(byGoverned.get(s.governedActionStatus) ?? []), s]);
  for (const group of byGoverned.values()) {
    for (const a of group)
      for (const b of group) {
        if (a === b) continue;
        if (JSON.stringify(a.temporalRelation) !== JSON.stringify(b.temporalRelation)) fields.add("temporalRelation");
        if (a.satisfactionCandidate !== b.satisfactionCandidate) fields.add("prerequisiteSatisfactionCandidateId");
        if (a.failureCandidate !== b.failureCandidate) fields.add("prerequisiteFailureCandidateId");
      }
  }
  return [...fields];
}

/** The full semantic closure — used when the governed-action axis itself is unsupported. */
export function governedActionClosure(): RepairableBoundaryField[] {
  return [...REPAIRABLE_BOUNDARY_FIELDS];
}

/** Codes that mean "this one candidate id is wrong" — nothing else about the row moves. */
const CANDIDATE_ONLY_CODES = new Set<string>([
  "boundary_candidate_required_missing",
  "boundary_candidate_forbidden_present",
  "boundary_candidate_unknown",
  "boundary_candidate_wrong_surface",
  "boundary_candidate_wrong_role",
  "boundary_candidate_wrong_boundary",
]);

/** Codes that mean the PREREQUISITE state itself cannot stand. */
const PREREQUISITE_GROUP_CODES = new Set<string>([
  "boundary_prerequisite_satisfaction_candidate_unavailable",
  "boundary_prerequisite_failure_candidate_unavailable",
  "boundary_prerequisite_contradiction",
]);

/** Codes that mean the GOVERNED-ACTION axis cannot stand. */
const GOVERNED_ACTION_GROUP_CODES = new Set<string>(["boundary_governed_action_candidate_unavailable", "boundary_assessment_state_invalid"]);

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type FieldRepairTarget = {
  boundaryId: string;
  surfaceRef: string;
  field: RepairableBoundaryField;
  groupId: string;
  groupFields: RepairableBoundaryField[];
  authorityCode: string;
  /** Deterministic server prose. Never model text. */
  reason: string;
  allowedValues: string[];
  candidateMenu: Array<{ candidateId: string; excerpt: string }> | null;
  /** The fields that stay put, with their frozen values — context, never a thing to resend. */
  frozenContext: Record<string, string>;
};

export type FieldRepairPlan = {
  repairable: boolean;
  because?: string;
  targets: FieldRepairTarget[];
  /** Rows that validated whole. Outside the plan entirely. */
  frozenSurfaceRefs: string[];
  baseRows: Array<{ surfaceRef: string; sha256: string }>;
  requiredOperationCount: number;
  dependencyGroupCount: number;
  /** The three subject digests the plan was built against, so a drift is named exactly. */
  digests: { boundaryReviewSubjectSha256: string; surfaceMapSha256: string; lineageSha256: string };
  planSha256: string;
};

const digest = (v: unknown): string => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
export const baseRowSha256 = (row: BoundaryTruthAssessment): string => digest(canonicalRow(row));

const canonicalRow = (r: BoundaryTruthAssessment) =>
  JSON.stringify([
    r.boundaryId,
    r.surfaceRef,
    r.governedActionStatus,
    r.prerequisiteStatus,
    r.temporalRelation,
    r.governedActionCandidateId,
    r.prerequisiteSatisfactionCandidateId,
    r.prerequisiteFailureCandidateId,
    r.reason,
  ]);

const menuFor = (ctx: NarrowReviewContext, boundaryId: string, surfaceRef: string, field: RepairableBoundaryField) => {
  const role = (Object.keys(CANDIDATE_FIELD_OF) as Array<keyof typeof CANDIDATE_FIELD_OF>).find((r) => CANDIDATE_FIELD_OF[r] === field);
  if (!role) return null;
  return poolFor(ctx.candidates, boundaryId, surfaceRef, role).map((c) => ({ candidateId: c.candidateId, excerpt: c.excerpt }));
};

const allowedFor = (field: RepairableBoundaryField, menu: Array<{ candidateId: string }> | null): string[] => {
  if (field === "governedActionStatus") return [...GOVERNED_ACTION_STATUSES];
  if (field === "prerequisiteStatus") return [...PREREQUISITE_STATUSES];
  if (field === "temporalRelation") return [...TEMPORAL_RELATIONS];
  return [NO_CANDIDATE, ...(menu ?? []).map((c) => c.candidateId)];
};

const REASONS: Record<string, string> = {
  boundary_candidate_required_missing: "this state requires a candidate from this role's list and the sentinel was sent instead",
  boundary_candidate_forbidden_present: "this state forbids a candidate for this role; the only legal value is the sentinel",
  boundary_candidate_unknown: "the id sent was never issued for this surface and role",
  boundary_candidate_wrong_surface: "the id sent belongs to another surface's list",
  boundary_candidate_wrong_role: "the id sent belongs to another evidence role on this surface",
  boundary_candidate_wrong_boundary: "the id sent belongs to another boundary",
  boundary_prerequisite_satisfaction_candidate_unavailable: "no satisfaction candidate exists on this surface, so the state chosen cannot be supported here",
  boundary_prerequisite_failure_candidate_unavailable: "no failure candidate exists on this surface, so the state chosen cannot be supported here",
  boundary_prerequisite_contradiction: "the row claims the prerequisite was both met and failed",
  boundary_governed_action_candidate_unavailable: "no governed-action candidate exists on this surface, so `present` cannot be supported here",
  boundary_assessment_state_invalid: "the three statuses do not form a canonical state",
};

/**
 * Build the repair plan from the FIRST response's validation.
 *
 * The base is always the parsed attempt-1 row. A row that validated whole is frozen and never enters
 * the plan; a row that failed contributes exactly the closure its codes require.
 */
export function planFieldRepair(
  baseRows: readonly BoundaryTruthAssessment[],
  ctx: NarrowReviewContext,
  digests: { boundaryReviewSubjectSha256: string; surfaceMapSha256: string; lineageSha256: string },
): FieldRepairPlan {
  const v = validateNarrowBoundaryReview({ assessments: baseRows }, ctx);
  const empty = (because: string): FieldRepairPlan => ({
    repairable: false,
    because,
    targets: [],
    frozenSurfaceRefs: [],
    baseRows: [],
    requiredOperationCount: 0,
    dependencyGroupCount: 0,
    digests: { ...digests },
    planSha256: digest([FIELD_REPAIR_VERSION, because]),
  });
  if (v.ok) return empty("field_repair_nothing_to_repair");

  const byRow = new Map<string, GroundingFinding[]>();
  for (const f of v.findings) byRow.set(f.surfaceRef, [...(byRow.get(f.surfaceRef) ?? []), f]);
  if (byRow.size === 0) return empty("field_repair_no_field_attribution");

  const rowByRef = new Map(baseRows.map((r) => [r.surfaceRef, r]));
  const targets: FieldRepairTarget[] = [];

  for (const surfaceRef of v.failedSurfaceRefs) {
    const row = rowByRef.get(surfaceRef);
    const found = byRow.get(surfaceRef) ?? [];
    // A failed row with no field-attributed finding cannot be patched safely — the whole response is
    // untrustworthy at that surface, and guessing a closure would be inventing authority.
    if (!row || found.length === 0) return empty("field_repair_no_field_attribution");

    const codes = found.map((f) => f.code);
    let fields: RepairableBoundaryField[];
    let owner: string;
    if (codes.some((c) => GOVERNED_ACTION_GROUP_CODES.has(c))) {
      fields = governedActionClosure();
      owner = codes.find((c) => GOVERNED_ACTION_GROUP_CODES.has(c))!;
    } else if (codes.some((c) => PREREQUISITE_GROUP_CODES.has(c))) {
      fields = prerequisiteClosure();
      owner = codes.find((c) => PREREQUISITE_GROUP_CODES.has(c))!;
    } else if (codes.every((c) => CANDIDATE_ONLY_CODES.has(c))) {
      fields = [...new Set(found.map((f) => f.field).filter((f): f is RepairableBoundaryField => f !== undefined))];
      owner = codes[0]!;
      if (fields.length === 0) return empty("field_repair_no_field_attribution");
    } else {
      // A reason/frame code, or anything else this graph does not model. Fail closed rather than
      // patch a row whose defect nobody localized.
      return empty("field_repair_unmodelled_code");
    }

    const groupId = digest([surfaceRef, owner, fields]).slice(0, 16);
    for (const field of fields) {
      const menu = menuFor(ctx, row.boundaryId, surfaceRef, field);
      targets.push({
        boundaryId: row.boundaryId,
        surfaceRef,
        field,
        groupId,
        groupFields: fields,
        authorityCode: owner,
        reason: REASONS[owner] ?? owner,
        allowedValues: allowedFor(field, menu),
        candidateMenu: menu,
        frozenContext: Object.fromEntries(
          REPAIRABLE_BOUNDARY_FIELDS.filter((f) => !fields.includes(f)).map((f) => [f, String((row as unknown as Record<string, unknown>)[f] ?? "")]),
        ),
      });
    }
  }

  const rows = baseRows.map((r) => ({ surfaceRef: r.surfaceRef, sha256: baseRowSha256(r) }));
  const plan: FieldRepairPlan = {
    repairable: targets.length > 0,
    targets,
    frozenSurfaceRefs: [...v.validSurfaceRefs],
    baseRows: rows,
    requiredOperationCount: targets.length,
    dependencyGroupCount: new Set(targets.map((t) => t.groupId)).size,
    digests: { ...digests },
    planSha256: "",
  };
  plan.planSha256 = digest([
    FIELD_REPAIR_VERSION,
    digests.boundaryReviewSubjectSha256,
    digests.surfaceMapSha256,
    digests.lineageSha256,
    rows,
    targets.map((t) => [t.surfaceRef, t.field, t.groupId, t.allowedValues]),
  ]);
  return plan;
}

// ---------------------------------------------------------------------------
// Patch validation
// ---------------------------------------------------------------------------

export type FieldRepairValidation =
  | { ok: true; operations: BoundaryFieldRepairOperation[]; codes: [] }
  | { ok: false; codes: FieldRepairCode[]; operations: BoundaryFieldRepairOperation[]; untargetedCount: number; missingCount: number; duplicateCount: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Accept a patch only when it is EXACTLY the plan. Every deviation is named; nothing is discarded
 * silently, and no value is ever inferred on the model's behalf.
 */
export function validateFieldRepairResponse(
  raw: unknown,
  plan: FieldRepairPlan,
  ctx: NarrowReviewContext,
  digests: { boundaryReviewSubjectSha256: string; surfaceMapSha256: string; lineageSha256: string },
  expected?: { planSha256?: string },
): FieldRepairValidation {
  const codes: FieldRepairCode[] = [];
  const push = (c: FieldRepairCode) => {
    if (!codes.includes(c)) codes.push(c);
  };
  let untargetedCount = 0;
  let missingCount = 0;
  let duplicateCount = 0;

  // The plan must be the one this response was asked for, and it must still describe the same
  // subject. Each input is compared directly, so a drift is NAMED rather than guessed at.
  if (digests.boundaryReviewSubjectSha256 !== plan.digests.boundaryReviewSubjectSha256) push("field_repair_subject_digest_mismatch");
  if (digests.surfaceMapSha256 !== plan.digests.surfaceMapSha256) push("field_repair_surface_map_digest_mismatch");
  if (digests.lineageSha256 !== plan.digests.lineageSha256) push("field_repair_lineage_digest_mismatch");
  const rebuilt = digest([
    FIELD_REPAIR_VERSION,
    plan.digests.boundaryReviewSubjectSha256,
    plan.digests.surfaceMapSha256,
    plan.digests.lineageSha256,
    plan.baseRows,
    plan.targets.map((t) => [t.surfaceRef, t.field, t.groupId, t.allowedValues]),
  ]);
  if (rebuilt !== plan.planSha256) push("field_repair_plan_digest_mismatch");
  if (expected?.planSha256 !== undefined && expected.planSha256 !== plan.planSha256) push("field_repair_plan_digest_mismatch");

  if (!isObj(raw) || !Array.isArray(raw.repairs)) {
    push("field_repair_not_a_patch");
    return { ok: false, codes, operations: [], untargetedCount, missingCount, duplicateCount };
  }
  const rawOps = raw.repairs;
  const operations: BoundaryFieldRepairOperation[] = [];
  const seen = new Set<string>();
  const targetKey = new Map(plan.targets.map((t) => [`${t.surfaceRef} ${t.field}`, t]));
  const targetSurfaces = new Set(plan.targets.map((t) => t.surfaceRef));

  for (const o of rawOps) {
    if (!isObj(o) || typeof o.surfaceRef !== "string" || typeof o.field !== "string" || typeof o.value !== "string") {
      // A full assessment row, or anything that is not a patch operation.
      push("field_repair_not_a_patch");
      continue;
    }
    const extraKeys = Object.keys(o).filter((k) => !["surfaceRef", "field", "value"].includes(k));
    if (extraKeys.length > 0) push("field_repair_not_a_patch");
    const op: BoundaryFieldRepairOperation = { surfaceRef: o.surfaceRef, field: o.field, value: o.value };
    operations.push(op);

    if ((IDENTITY_FIELDS as readonly string[]).includes(op.field)) {
      push("field_repair_identity_field");
      untargetedCount++;
      continue;
    }
    const key = `${op.surfaceRef} ${op.field}`;
    if (seen.has(key)) {
      push("field_repair_operation_duplicate");
      duplicateCount++;
      continue;
    }
    seen.add(key);

    if (!targetSurfaces.has(op.surfaceRef)) {
      push("field_repair_surface_untargeted");
      untargetedCount++;
      continue;
    }
    const target = targetKey.get(key);
    if (!target) {
      push("field_repair_field_untargeted");
      untargetedCount++;
      continue;
    }
    if (!target.allowedValues.includes(op.value)) {
      // A candidate id gets the precise reason it is not allowed; a status gets the value code.
      if (target.field.endsWith("CandidateId")) {
        const all = ctx.candidates.filter((c) => c.candidateId === op.value);
        if (all.length === 0) push("field_repair_candidate_unknown");
        else if (!all.some((c) => c.assessedSurfaceRef === op.surfaceRef)) push("field_repair_candidate_wrong_surface");
        else if (!all.some((c) => CANDIDATE_FIELD_OF[c.semanticRole] === target.field)) push("field_repair_candidate_wrong_role");
        else push("field_repair_candidate_not_in_menu");
      } else push("field_repair_value_not_allowed");
    }
  }

  // Every required operation, exactly once.
  for (const t of plan.targets) {
    if (!seen.has(`${t.surfaceRef} ${t.field}`)) {
      push("field_repair_operation_missing");
      missingCount++;
    }
  }
  // A dependency group is atomic: all of it, or none of it.
  for (const groupId of new Set(plan.targets.map((t) => t.groupId))) {
    const group = plan.targets.filter((t) => t.groupId === groupId);
    const supplied = group.filter((t) => seen.has(`${t.surfaceRef} ${t.field}`)).length;
    if (supplied > 0 && supplied < group.length) push("field_repair_dependency_group_partial");
  }
  if (operations.length !== plan.requiredOperationCount) push("field_repair_operation_count_mismatch");

  if (codes.length > 0) return { ok: false, codes, operations, untargetedCount, missingCount, duplicateCount };
  return { ok: true, operations, codes: [] };
}

// ---------------------------------------------------------------------------
// Field-level merge
// ---------------------------------------------------------------------------

export type FieldRepairMetrics = {
  fieldRepairSurfaceCount: number;
  fieldRepairOperationCount: number;
  fieldRepairDependencyGroupCount: number;
  fieldRepairMissingOperationCount: number;
  fieldRepairDuplicateOperationCount: number;
  fieldRepairUntargetedOperationCount: number;
  /** Structurally 0 — a non-targeted field is copied byte-for-byte. Asserted, not assumed. */
  fieldRepairFrozenMutationCount: number;
  fieldRepairMergedRowInvalidCount: number;
};

export type FieldRepairMerge =
  | { ok: true; rows: BoundaryTruthAssessment[]; codes: []; metrics: FieldRepairMetrics; mergedRowSha256: Array<{ surfaceRef: string; sha256: string }> }
  | { ok: false; codes: FieldRepairCode[]; rows: []; metrics: FieldRepairMetrics; mergedRowSha256: [] };

/**
 * Apply accepted operations to the exact attempt-1 rows.
 *
 * Order matters and is fixed: verify the base digest, apply only accepted operations, copy every
 * other field byte-for-byte, then re-run the ORIGINAL canonical validator over the whole matrix.
 * The repair layer never constructs a verdict — it hands a complete matrix back to the one validator
 * that already exists, or it fails.
 */
export function mergeFieldRepair(
  baseRows: readonly BoundaryTruthAssessment[],
  validation: FieldRepairValidation,
  plan: FieldRepairPlan,
  ctx: NarrowReviewContext,
): FieldRepairMerge {
  const codes: FieldRepairCode[] = [];
  const metrics: FieldRepairMetrics = {
    fieldRepairSurfaceCount: new Set(plan.targets.map((t) => t.surfaceRef)).size,
    fieldRepairOperationCount: plan.requiredOperationCount,
    fieldRepairDependencyGroupCount: plan.dependencyGroupCount,
    fieldRepairMissingOperationCount: validation.ok ? 0 : validation.missingCount,
    fieldRepairDuplicateOperationCount: validation.ok ? 0 : validation.duplicateCount,
    fieldRepairUntargetedOperationCount: validation.ok ? 0 : validation.untargetedCount,
    fieldRepairFrozenMutationCount: 0,
    fieldRepairMergedRowInvalidCount: 0,
  };
  const fail = (): FieldRepairMerge => ({ ok: false, codes, rows: [], metrics, mergedRowSha256: [] });

  if (!validation.ok) {
    codes.push(...validation.codes);
    return fail();
  }
  // (2) The base must be exactly what the plan was built from.
  const planDigest = new Map(plan.baseRows.map((r) => [r.surfaceRef, r.sha256]));
  for (const row of baseRows) {
    if (planDigest.get(row.surfaceRef) !== baseRowSha256(row)) {
      if (!codes.includes("field_repair_base_row_digest_mismatch")) codes.push("field_repair_base_row_digest_mismatch");
    }
  }
  if (codes.length > 0) return fail();

  const opBySurface = new Map<string, BoundaryFieldRepairOperation[]>();
  for (const o of validation.operations) opBySurface.set(o.surfaceRef, [...(opBySurface.get(o.surfaceRef) ?? []), o]);
  const targetedFields = new Map<string, Set<string>>();
  for (const t of plan.targets) targetedFields.set(t.surfaceRef, (targetedFields.get(t.surfaceRef) ?? new Set()).add(t.field));

  const rows: BoundaryTruthAssessment[] = baseRows.map((row) => {
    const ops = opBySurface.get(row.surfaceRef) ?? [];
    if (ops.length === 0) return row;
    const next = { ...row } as unknown as Record<string, unknown>;
    for (const o of ops) next[o.field] = o.value;
    // (4) Prove nothing outside the targeted set moved.
    const allowed = targetedFields.get(row.surfaceRef) ?? new Set<string>();
    for (const f of REPAIRABLE_BOUNDARY_FIELDS) {
      if (allowed.has(f)) continue;
      if (next[f] !== (row as unknown as Record<string, unknown>)[f]) metrics.fieldRepairFrozenMutationCount++;
    }
    for (const f of IDENTITY_FIELDS) if (next[f] !== (row as unknown as Record<string, unknown>)[f]) metrics.fieldRepairFrozenMutationCount++;
    return next as unknown as BoundaryTruthAssessment;
  });

  if (metrics.fieldRepairFrozenMutationCount > 0) {
    codes.push("field_repair_frozen_field_mutated");
    return fail();
  }

  // (5,6) The ORIGINAL validator decides. A patch that satisfied its own menu but leaves the merged
  // row incoherent is refused here, not passed downstream.
  const merged = validateNarrowBoundaryReview({ assessments: rows }, ctx);
  if (!merged.ok) {
    metrics.fieldRepairMergedRowInvalidCount = merged.failedSurfaceRefs.length;
    codes.push("field_repair_merged_row_invalid");
    return fail();
  }
  return { ok: true, rows, codes: [], metrics, mergedRowSha256: rows.map((r) => ({ surfaceRef: r.surfaceRef, sha256: baseRowSha256(r) })) };
}

export const summarizeFieldRepair = (plan: FieldRepairPlan, validation: FieldRepairValidation, merge: FieldRepairMerge): FieldRepairMetrics => ({
  ...merge.metrics,
  fieldRepairSurfaceCount: new Set(plan.targets.map((t) => t.surfaceRef)).size,
  fieldRepairOperationCount: plan.requiredOperationCount,
  fieldRepairDependencyGroupCount: plan.dependencyGroupCount,
  fieldRepairMissingOperationCount: validation.ok ? 0 : validation.missingCount,
  fieldRepairDuplicateOperationCount: validation.ok ? 0 : validation.duplicateCount,
  fieldRepairUntargetedOperationCount: validation.ok ? 0 : validation.untargetedCount,
});

export const fieldRepairContractSha256 = (): string =>
  digest({
    version: FIELD_REPAIR_VERSION,
    schemaName: FIELD_REPAIR_SCHEMA_NAME,
    codes: FIELD_REPAIR_CODES,
    repairableFields: REPAIRABLE_BOUNDARY_FIELDS,
    identityFieldsNeverRepairable: IDENTITY_FIELDS,
    patchOnlyResponse: true,
    fullRowsRefused: true,
    frozenFieldsAbsentFromExchange: true,
    prerequisiteClosure: prerequisiteClosure(),
    governedActionClosure: governedActionClosure(),
    closureDerivedFromTruthStateTable: true,
    dependencyGroupsAtomic: true,
    exactOperationSetRequired: true,
    extraOperationsRefusedNotDiscarded: true,
    valuesNeverInferred: true,
    forbiddenCandidateNeverNormalized: true,
    mergedRowRevalidatedByCanonicalValidator: true,
    partialMatrixNeverProducesVerdict: true,
  });
