/**
 * PROVIDER-FACING generation DTO + deterministic canonicalization (Slice 3.2I-R5B1A.1-R2.16).
 *
 * WHY THIS EXISTS
 * The 3-case canary generated 0 of 3 with the model responding normally (16.4–24.6 s). Every
 * rejection was a TRANSPORT-IDENTITY failure, not a judgment-content failure:
 *   action_choice_missing_commitment_flag · duplicate_choice_id · branch_orphan_key
 * The old contract asked the model to author relational identity — unique choice ids, and a
 * `branches` object whose KEYS had to exactly match the primary choice ids it had just invented.
 * A dynamic-key object keyed by model-authored strings is not a reliable relational contract, and
 * it cannot be expressed in a provider strict JSON Schema at all (strict mode requires every
 * property named with additionalProperties:false).
 *
 * SEPARATION OF AUTHORITY
 *   The model authors user-facing judgment content: title, opening, labels, escalations, prompts,
 *   the commitment flag, and constraint rationales.
 *   The SERVER authors transport identity: every choice id, and the branch→primary relationship,
 *   assigned deterministically from array position AFTER the provider result fully validates.
 *
 * Choice ids were confirmed to be pure transport: they are never rendered (the player renders
 * `label`), no code parses or derives meaning from their text, and they are used only as React
 * keys and as `selected_path` values. Assignment happens at generation ingestion, BEFORE first
 * persistence — an already-published scenario is never re-identified.
 *
 * Pure domain: no I/O, no provider calls, no DB. Never invents, merges, reorders or edits content.
 */

import {
  ACTION_CHOICES_MAX,
  ACTION_CHOICES_MIN,
  PRIMARY_CHOICES_MAX,
  PRIMARY_CHOICES_MIN,
  TRADEOFF_CHOICES_MAX,
  TRADEOFF_CHOICES_MIN,
  type ArenaScenarioDraft,
  type ScenarioBranch,
} from "./types";
import type { ConstraintAssessment } from "./boundary";
import { BOUNDARY_GROUNDING_JSON_SCHEMA, DECISION_STAGES, type DecisionStage, type ProviderBoundaryGrounding } from "./boundaryGrounding";
import { CHOICE_CONSTRUCTION_JSON_SCHEMA, type ProviderChoiceConstruction } from "./choiceConstruction";

// ---------------------------------------------------------------------------
// The DTO — array-based, no model-authored identifiers, no dynamic keys.
// ---------------------------------------------------------------------------

export type ProviderChoice = {
  label: string;
  /** One entry per confirmed constraint. Empty array when the boundary has no constraints. */
  constraintAssessments: ConstraintAssessment[];
  /**
   * R2.22 — how this choice was CONSTRUCTED: the value it protects, the cost it accepts, why a
   * competent person could choose it. Provider-only: validated, reviewed, then discarded.
   */
  construction: ProviderChoiceConstruction;
};
export type ProviderActionChoice = ProviderChoice & { isActionCommitment: boolean };
export type ProviderActionDecision = { prompt: string; choices: ProviderActionChoice[] };
export type ProviderBranch = {
  resultingWorldState: string;
  escalationText: string;
  tradeoffChoices: ProviderChoice[];
  actionDecision: ProviderActionDecision;
};

/**
 * `branches[i]` is the continuation of `primaryChoices[i]` — position IS the relationship, so the
 * model never authors a key that can orphan.
 */
export type ProviderPracticeScenario = {
  noSafeJudgmentSpace: boolean;
  title: string;
  opening: string;
  primaryChoices: ProviderChoice[];
  flatEscalationText: string;
  flatTradeoffChoices: ProviderChoice[];
  flatActionDecision: ProviderActionDecision;
  branches: ProviderBranch[];
  /**
   * One grounding declaration per CONFIRMED boundary (R2.21) — empty when the boundary has no
   * constraints. Provider/reviewer-only: it is validated then discarded, never persisted in the
   * canonical draft and never rendered to a learner.
   */
  boundaryGrounding: ProviderBoundaryGrounding[];
};

export const PROVIDER_SCHEMA_NAME = "bty_practice_scenario_v1";

// ---------------------------------------------------------------------------
// Strict JSON Schema — every property required, additionalProperties false,
// bounded arrays, no dynamic property names, explicit booleans.
// ---------------------------------------------------------------------------

const assessmentSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      constraintId: { type: "string" },
      status: { type: "string", enum: ["satisfied"] },
      rationale: { type: "string" },
    },
    required: ["constraintId", "status", "rationale"],
  },
} as const;

const choiceSchema = {
  type: "object",
  additionalProperties: false,
  properties: { label: { type: "string" }, constraintAssessments: assessmentSchema, construction: CHOICE_CONSTRUCTION_JSON_SCHEMA },
  required: ["label", "constraintAssessments", "construction"],
} as const;

const actionChoiceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    isActionCommitment: { type: "boolean" },
    constraintAssessments: assessmentSchema,
    construction: CHOICE_CONSTRUCTION_JSON_SCHEMA,
  },
  required: ["label", "isActionCommitment", "constraintAssessments", "construction"],
} as const;

const actionDecisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: { type: "string" },
    choices: { type: "array", minItems: ACTION_CHOICES_MIN, maxItems: ACTION_CHOICES_MAX, items: actionChoiceSchema },
  },
  required: ["prompt", "choices"],
} as const;

export const PROVIDER_SCENARIO_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    noSafeJudgmentSpace: { type: "boolean" },
    title: { type: "string" },
    opening: { type: "string" },
    primaryChoices: { type: "array", minItems: PRIMARY_CHOICES_MIN, maxItems: PRIMARY_CHOICES_MAX, items: choiceSchema },
    flatEscalationText: { type: "string" },
    flatTradeoffChoices: { type: "array", minItems: TRADEOFF_CHOICES_MIN, maxItems: TRADEOFF_CHOICES_MAX, items: choiceSchema },
    flatActionDecision: actionDecisionSchema,
    branches: {
      type: "array",
      minItems: PRIMARY_CHOICES_MIN,
      maxItems: PRIMARY_CHOICES_MAX,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          resultingWorldState: { type: "string" },
          escalationText: { type: "string" },
          tradeoffChoices: { type: "array", minItems: TRADEOFF_CHOICES_MIN, maxItems: TRADEOFF_CHOICES_MAX, items: choiceSchema },
          actionDecision: actionDecisionSchema,
        },
        required: ["resultingWorldState", "escalationText", "tradeoffChoices", "actionDecision"],
      },
    },
    boundaryGrounding: BOUNDARY_GROUNDING_JSON_SCHEMA,
  },
  required: [
    "noSafeJudgmentSpace",
    "title",
    "opening",
    "primaryChoices",
    "flatEscalationText",
    "flatTradeoffChoices",
    "flatActionDecision",
    "branches",
    "boundaryGrounding",
  ],
} as const;

// ---------------------------------------------------------------------------
// DTO validation — structural only. Content gates stay in the canonical layer.
// ---------------------------------------------------------------------------

export type DtoValidation = { ok: true; value: ProviderPracticeScenario } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function validateAssessments(v: unknown, errors: string[], where: string): ConstraintAssessment[] {
  if (!Array.isArray(v)) {
    errors.push(`dto_assessments_not_array:${where}`);
    return [];
  }
  const out: ConstraintAssessment[] = [];
  for (const a of v) {
    if (!isObj(a) || !isNonEmpty(a.constraintId) || a.status !== "satisfied" || !isNonEmpty(a.rationale)) {
      errors.push(`dto_assessment_malformed:${where}`);
      continue;
    }
    out.push({ constraintId: a.constraintId, status: "satisfied", rationale: a.rationale });
  }
  return out;
}

/**
 * Structural shape of the construction record only (R2.22). Whether the stated value is genuine and
 * the cost real is decided by `validateChoiceConstructions` + the semantic reviewer.
 */
function parseConstruction(v: unknown, errors: string[], where: string): ProviderChoiceConstruction {
  if (!isObj(v)) {
    errors.push(`dto_construction_missing:${where}`);
    return { legitimateValue: "", acceptedCost: "", competentIntent: "", concreteAction: "", boundaryCompliance: [], urgencySafetyBasis: "", whyNotDominated: "", distinguishesFromSibling: "" };
  }
  const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  return {
    legitimateValue: s("legitimateValue"),
    acceptedCost: s("acceptedCost"),
    competentIntent: s("competentIntent"),
    concreteAction: s("concreteAction"),
    boundaryCompliance: Array.isArray(v.boundaryCompliance) ? v.boundaryCompliance.filter((b): b is string => typeof b === "string") : [],
    urgencySafetyBasis: s("urgencySafetyBasis"),
    whyNotDominated: s("whyNotDominated"),
    distinguishesFromSibling: s("distinguishesFromSibling"),
  };
}

function validateChoices(v: unknown, min: number, max: number, where: string, errors: string[]): ProviderChoice[] {
  if (!Array.isArray(v)) {
    errors.push(`dto_choices_not_array:${where}`);
    return [];
  }
  if (v.length < min || v.length > max) errors.push(`dto_choice_count:${where}`);
  return v.map((c, i) => {
    if (!isObj(c) || !isNonEmpty(c.label)) {
      errors.push(`dto_choice_malformed:${where}[${i}]`);
      return { label: "", constraintAssessments: [], construction: parseConstruction(null, [], "") };
    }
    return {
      label: c.label,
      constraintAssessments: validateAssessments(c.constraintAssessments, errors, `${where}[${i}]`),
      construction: parseConstruction(c.construction, errors, `${where}[${i}]`),
    };
  });
}

function validateActionDecision(v: unknown, where: string, errors: string[]): ProviderActionDecision {
  if (!isObj(v)) {
    errors.push(`dto_action_missing:${where}`);
    return { prompt: "", choices: [] };
  }
  if (!isNonEmpty(v.prompt)) errors.push(`dto_action_prompt_missing:${where}`);
  const raw = Array.isArray(v.choices) ? v.choices : [];
  if (!Array.isArray(v.choices)) errors.push(`dto_choices_not_array:${where}.action`);
  if (raw.length < ACTION_CHOICES_MIN || raw.length > ACTION_CHOICES_MAX) errors.push(`dto_choice_count:${where}.action`);
  const choices: ProviderActionChoice[] = raw.map((c, i) => {
    if (!isObj(c) || !isNonEmpty(c.label)) {
      errors.push(`dto_choice_malformed:${where}.action[${i}]`);
      return { label: "", isActionCommitment: false, constraintAssessments: [], construction: parseConstruction(null, [], "") };
    }
    // The exact invariant the canonical validator enforces — an explicit boolean, never inferred.
    if (typeof c.isActionCommitment !== "boolean") errors.push("action_choice_missing_commitment_flag");
    return {
      label: c.label,
      isActionCommitment: c.isActionCommitment === true,
      constraintAssessments: validateAssessments(c.constraintAssessments, errors, `${where}.action[${i}]`),
      construction: parseConstruction(c.construction, errors, `${where}.action[${i}]`),
    };
  });
  // Preserve the existing product rule: at least one real action commitment per phase.
  if (choices.length > 0 && !choices.some((c) => c.isActionCommitment)) errors.push("no_action_commitment");
  return { prompt: isObj(v) && isNonEmpty(v.prompt) ? v.prompt : "", choices };
}

/**
 * Structural shape of the grounding declaration only. Whether it MATCHES the confirmed constraints
 * and the scenario is decided by `validateBoundaryGrounding`, which needs both — see
 * `boundaryGrounding.ts`.
 */
function validateGrounding(v: unknown, errors: string[]): ProviderBoundaryGrounding[] {
  if (!Array.isArray(v)) {
    errors.push("dto_grounding_not_array");
    return [];
  }
  const out: ProviderBoundaryGrounding[] = [];
  for (const g of v) {
    if (!isObj(g) || !isNonEmpty(g.boundaryId)) {
      errors.push("dto_grounding_malformed");
      continue;
    }
    out.push({
      boundaryId: g.boundaryId,
      boundaryStatement: typeof g.boundaryStatement === "string" ? g.boundaryStatement : "",
      scenarioPresence: typeof g.scenarioPresence === "string" ? g.scenarioPresence : "",
      operationalEffect: typeof g.operationalEffect === "string" ? g.operationalEffect : "",
      affectedDecisionStages: (Array.isArray(g.affectedDecisionStages) ? g.affectedDecisionStages : []).filter(
        (s): s is DecisionStage => (DECISION_STAGES as readonly string[]).includes(s as string),
      ),
      prohibitedAlternativeExcluded: typeof g.prohibitedAlternativeExcluded === "string" ? g.prohibitedAlternativeExcluded : "",
      remainingJudgmentDimensions: (Array.isArray(g.remainingJudgmentDimensions) ? g.remainingJudgmentDimensions : []).filter(
        (d): d is string => isNonEmpty(d),
      ),
    });
  }
  return out;
}

/** Structurally validate a raw provider result against the DTO contract. Content is untouched. */
export function validateProviderScenario(raw: unknown): DtoValidation {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["dto_not_an_object"] };

  if (raw.noSafeJudgmentSpace === true) {
    // The safe-refusal signal. No further structure is required or inspected.
    return {
      ok: true,
      value: {
        noSafeJudgmentSpace: true,
        title: "",
        opening: "",
        primaryChoices: [],
        flatEscalationText: "",
        flatTradeoffChoices: [],
        flatActionDecision: { prompt: "", choices: [] },
        branches: [],
        boundaryGrounding: [],
      },
    };
  }

  if (!isNonEmpty(raw.title)) errors.push("dto_title_missing");
  if (!isNonEmpty(raw.opening)) errors.push("dto_opening_missing");
  const primaryChoices = validateChoices(raw.primaryChoices, PRIMARY_CHOICES_MIN, PRIMARY_CHOICES_MAX, "primary", errors);
  if (!isNonEmpty(raw.flatEscalationText)) errors.push("dto_flat_escalation_missing");
  const flatTradeoffChoices = validateChoices(raw.flatTradeoffChoices, TRADEOFF_CHOICES_MIN, TRADEOFF_CHOICES_MAX, "flatTradeoff", errors);
  const flatActionDecision = validateActionDecision(raw.flatActionDecision, "flat", errors);

  const rawBranches = Array.isArray(raw.branches) ? raw.branches : null;
  if (rawBranches === null) errors.push("dto_branches_not_array");
  const branches: ProviderBranch[] = (rawBranches ?? []).map((b, i) => {
    if (!isObj(b)) {
      errors.push(`dto_branch_malformed:[${i}]`);
      return { resultingWorldState: "", escalationText: "", tradeoffChoices: [], actionDecision: { prompt: "", choices: [] } };
    }
    if (!isNonEmpty(b.escalationText)) errors.push(`dto_branch_escalation_missing:[${i}]`);
    return {
      resultingWorldState: typeof b.resultingWorldState === "string" ? b.resultingWorldState : "",
      escalationText: isNonEmpty(b.escalationText) ? b.escalationText : "",
      tradeoffChoices: validateChoices(b.tradeoffChoices, TRADEOFF_CHOICES_MIN, TRADEOFF_CHOICES_MAX, `branch[${i}]`, errors),
      actionDecision: validateActionDecision(b.actionDecision, `branch[${i}]`, errors),
    };
  });

  // POSITIONAL RELATIONSHIP: exactly one continuation per primary choice. This replaces the
  // model-authored branch key that produced `branch_orphan_key` — an orphan is now unrepresentable.
  if (rawBranches !== null && branches.length !== primaryChoices.length) errors.push("dto_branch_count_mismatch");

  const boundaryGrounding = validateGrounding(raw.boundaryGrounding, errors);

  return errors.length ? { ok: false, errors } : {
    ok: true,
    value: {
      noSafeJudgmentSpace: false,
      title: raw.title as string,
      opening: raw.opening as string,
      primaryChoices,
      flatEscalationText: raw.flatEscalationText as string,
      flatTradeoffChoices,
      flatActionDecision,
      branches,
      boundaryGrounding,
    },
  };
}

// ---------------------------------------------------------------------------
// Deterministic server-side transport identity.
// ---------------------------------------------------------------------------

/** Stable hierarchy-and-position ids. No randomness, no hashing of user text, no label identity. */
export const primaryId = (i: number): string => `p${i + 1}`;
export const branchTradeoffId = (p: number, i: number): string => `p${p + 1}-t${i + 1}`;
export const branchActionId = (p: number, i: number): string => `p${p + 1}-a${i + 1}`;
export const flatTradeoffId = (i: number): string => `ft${i + 1}`;
export const flatActionId = (i: number): string => `fa${i + 1}`;

export type CanonicalizedScenario = {
  draft: ArenaScenarioDraft;
  /** Keyed by ASSIGNED canonical choice id — exactly what validateConstraintAssessments expects. */
  assessmentsByChoiceId: Record<string, ConstraintAssessment[]>;
  /**
   * Per-choice construction records keyed by ASSIGNED canonical choice id (R2.22). Carried outside
   * the draft for the same reason as the grounding: provider-only, never persisted, never rendered.
   */
  constructionsByChoiceId: Record<string, ProviderChoiceConstruction>;
  /**
   * Grounding declarations, carried OUTSIDE the draft (R2.21). They are generation/review-time
   * analysis: validated, used for retry feedback, then dropped. Keeping them off `draft` is what
   * guarantees they are never persisted and never rendered.
   */
  boundaryGrounding: ProviderBoundaryGrounding[];
};

/**
 * Convert a VALIDATED provider DTO into the canonical draft, assigning transport ids by position.
 *
 * Content is copied verbatim: no text is edited, translated, merged, reordered, inserted or
 * dropped. Duplicate labels stay duplicated — that is a quality question judged elsewhere, never
 * an identity question resolved by merging.
 */
export function canonicalizeProviderScenario(dto: ProviderPracticeScenario): CanonicalizedScenario {
  const assessmentsByChoiceId: Record<string, ConstraintAssessment[]> = {};
  const constructionsByChoiceId: Record<string, ProviderChoiceConstruction> = {};
  const put = (id: string, c: ProviderChoice) => {
    assessmentsByChoiceId[id] = c.constraintAssessments;
    constructionsByChoiceId[id] = c.construction;
  };

  const primary = dto.primaryChoices.map((c, i) => {
    put(primaryId(i), c);
    return { id: primaryId(i), label: c.label };
  });

  const flatTradeoff = dto.flatTradeoffChoices.map((c, i) => {
    put(flatTradeoffId(i), c);
    return { id: flatTradeoffId(i), label: c.label };
  });

  const flatAction = dto.flatActionDecision.choices.map((c, i) => {
    put(flatActionId(i), c);
    return { id: flatActionId(i), label: c.label, isActionCommitment: c.isActionCommitment };
  });

  // Zip branch N to primary N, then key the canonical map by the ASSIGNED primary id.
  const branches: Record<string, ScenarioBranch> = {};
  dto.branches.forEach((b, p) => {
    const tradeoffChoices = b.tradeoffChoices.map((c, i) => {
      put(branchTradeoffId(p, i), c);
      return { id: branchTradeoffId(p, i), label: c.label };
    });
    const choices = b.actionDecision.choices.map((c, i) => {
      put(branchActionId(p, i), c);
      return { id: branchActionId(p, i), label: c.label, isActionCommitment: c.isActionCommitment };
    });
    branches[primaryId(p)] = {
      ...(b.resultingWorldState.trim() ? { resultingWorldState: b.resultingWorldState } : {}),
      escalationText: b.escalationText,
      tradeoffChoices,
      actionDecision: { prompt: b.actionDecision.prompt, choices },
    };
  });

  const draft: ArenaScenarioDraft = {
    title: dto.title,
    opening: dto.opening,
    primary: { choices: primary },
    tradeoff: { escalationText: dto.flatEscalationText, choices: flatTradeoff },
    actionDecision: { prompt: dto.flatActionDecision.prompt, choices: flatAction },
    ...(dto.branches.length ? { branches } : {}),
  };

  return { draft, assessmentsByChoiceId, constructionsByChoiceId, boundaryGrounding: dto.boundaryGrounding };
}
