/**
 * Foundry Practice — structured Practice BOUNDARY (pure) [Slice 3.2I-R4].
 *
 * BTY may SUGGEST a mandatory boundary from free text; the Manager CONFIRMS it; the model
 * generates choices INSIDE it; a separate review proves no choice crosses it. This module
 * owns the structured, confirmed boundary object (never keyword inference as final
 * authority), its validation, provenance-labeled suggestions, and per-choice constraint-
 * assessment validation. No DB, no I/O, no provider.
 */

import { extractConstraintStatements, type SafetyClassificationInput } from "./safety";
import type { ArenaScenarioDraft } from "./types";

export type PracticeBoundaryMode = "knowledge_check" | "judgment" | "judgment_with_constraints";

export type BoundaryProvenance =
  | "manager_entered"
  | "suggested_from_problem"
  | "suggested_from_expected_behavior"
  | "suggested_from_success_evidence"
  | "suggested_from_source_material";

export type BoundaryConstraint = { id: string; statement: string; provenance: BoundaryProvenance };

/** The Manager-confirmed practice boundary, persisted inside the draft JSONB. */
export type PracticeBoundary = {
  mode: PracticeBoundaryMode;
  confirmed: boolean;
  constraints: BoundaryConstraint[];
};

/** Internal generation-time annotation — NEVER learner-facing, never persisted. */
export type ConstraintAssessment = { constraintId: string; status: "satisfied"; rationale: string };

export const CONSTRAINT_STATEMENT_MAX = 300;
export const CONSTRAINTS_MAX = 10;
const BOUNDARY_MODES: readonly PracticeBoundaryMode[] = ["knowledge_check", "judgment", "judgment_with_constraints"];
const PROVENANCES: readonly BoundaryProvenance[] = [
  "manager_entered",
  "suggested_from_problem",
  "suggested_from_expected_behavior",
  "suggested_from_success_evidence",
  "suggested_from_source_material",
];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable id for a constraint (index + short slug of the statement). Deterministic. */
export function constraintId(index: number, statement: string): string {
  const slug = normalize(statement).replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return `c${index + 1}_${slug || "rule"}`;
}

/**
 * Suggest candidate constraints from authorized training facts, each with provenance. These
 * are SUGGESTIONS ONLY — unconfirmed; the Manager must accept/edit/remove before they gain
 * generation authority. De-duplicated by normalized statement.
 */
export function suggestConstraints(input: SafetyClassificationInput): BoundaryConstraint[] {
  const sources: Array<{ text: string | null | undefined; provenance: BoundaryProvenance }> = [
    { text: input.problem, provenance: "suggested_from_problem" },
    { text: input.observableBehavior, provenance: "suggested_from_expected_behavior" },
    { text: input.successEvidence, provenance: "suggested_from_success_evidence" },
  ];
  const out: BoundaryConstraint[] = [];
  const seen = new Set<string>();
  for (const { text, provenance } of sources) {
    if (!text) continue;
    for (const statement of extractConstraintStatements(text)) {
      const key = normalize(statement);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: constraintId(out.length, statement), statement: statement.trim(), provenance });
      if (out.length >= CONSTRAINTS_MAX) return out;
    }
  }
  return out;
}

export type BoundaryValidation = { ok: boolean; errors: string[] };

/** Validate a (client-submitted or stored) boundary. Fail-closed. Pure. */
export function validateBoundary(raw: unknown): BoundaryValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["boundary_invalid"] };
  const b = raw as Partial<PracticeBoundary>;

  if (!BOUNDARY_MODES.includes(b.mode as PracticeBoundaryMode)) errors.push("boundary_mode_invalid");
  if (typeof b.confirmed !== "boolean") errors.push("boundary_confirmed_invalid");

  const constraints = Array.isArray(b.constraints) ? b.constraints : [];
  if (!Array.isArray(b.constraints)) errors.push("boundary_constraints_invalid");
  if (constraints.length > CONSTRAINTS_MAX) errors.push("boundary_too_many_constraints");

  const ids = new Set<string>();
  const statements = new Set<string>();
  for (const c of constraints) {
    if (typeof c !== "object" || c === null) {
      errors.push("constraint_invalid");
      continue;
    }
    const cc = c as Partial<BoundaryConstraint>;
    if (typeof cc.id !== "string" || cc.id.trim().length === 0) errors.push("constraint_id_invalid");
    else if (ids.has(cc.id)) errors.push("constraint_duplicate_id");
    else ids.add(cc.id);
    if (typeof cc.statement !== "string" || cc.statement.trim().length === 0) errors.push("constraint_statement_empty");
    else if (cc.statement.trim().length > CONSTRAINT_STATEMENT_MAX) errors.push("constraint_statement_too_long");
    else {
      const key = normalize(cc.statement);
      if (statements.has(key)) errors.push("constraint_duplicate_statement");
      else statements.add(key);
    }
    if (!PROVENANCES.includes(cc.provenance as BoundaryProvenance)) errors.push("constraint_provenance_invalid");
  }

  // A constrained boundary requires at least one constraint; knowledge/judgment need none.
  if (b.mode === "judgment_with_constraints" && constraints.length === 0) errors.push("boundary_constraints_required");

  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

/** All learner-facing choice ids across the draft (flat + branches). */
function allChoiceIds(draft: ArenaScenarioDraft): string[] {
  const ids = [
    ...draft.primary.choices,
    ...draft.tradeoff.choices,
    ...draft.actionDecision.choices,
  ].map((c) => c.id);
  for (const b of Object.values(draft.branches ?? {})) {
    ids.push(...b.tradeoffChoices.map((c) => c.id), ...b.actionDecision.choices.map((c) => c.id));
  }
  return ids;
}

/**
 * Validate the provider's internal per-choice constraint assessments (Slice 3.2I-R4): every
 * learner-facing choice must account for EVERY confirmed constraint as `satisfied`, with no
 * unknown or missing constraint ids and no violated status. Generation-time only — the
 * assessments are validated then DISCARDED (never persisted, never learner-facing). Pure.
 */
export function validateConstraintAssessments(
  draft: ArenaScenarioDraft,
  constraintIds: string[],
  assessmentsByChoiceId: unknown,
): BoundaryValidation {
  const errors: string[] = [];
  if (constraintIds.length === 0) return { ok: true, errors };
  if (typeof assessmentsByChoiceId !== "object" || assessmentsByChoiceId === null) {
    return { ok: false, errors: ["assessment_missing"] };
  }
  const map = assessmentsByChoiceId as Record<string, unknown>;
  const constraintSet = new Set(constraintIds);

  for (const choiceId of allChoiceIds(draft)) {
    const list = map[choiceId];
    if (!Array.isArray(list)) {
      errors.push("assessment_missing_for_choice");
      continue;
    }
    const covered = new Set<string>();
    for (const a of list) {
      if (typeof a !== "object" || a === null) {
        errors.push("assessment_malformed");
        continue;
      }
      const aa = a as Partial<ConstraintAssessment>;
      if (typeof aa.constraintId !== "string" || !constraintSet.has(aa.constraintId)) errors.push("assessment_unknown_constraint");
      else covered.add(aa.constraintId);
      if (aa.status !== "satisfied") errors.push("assessment_not_satisfied");
      if (typeof aa.rationale !== "string" || aa.rationale.trim().length === 0) errors.push("assessment_rationale_empty");
    }
    for (const cid of constraintSet) if (!covered.has(cid)) errors.push("assessment_constraint_uncovered");
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}
