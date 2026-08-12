/**
 * Direction-to-Module Draft Copilot — domain (pure, Slice 2.4B).
 *
 * The Host has chosen and applied a direction (Capability + observable behavior +
 * success evidence) and picked an audience. This layer (a) reconstructs the minimum
 * canonical generation context from the draft answers, (b) validates a single
 * structured "rest of the module" draft FAIL-CLOSED, mapping every proposed value to
 * the values the live Builder can actually represent, and (c) provides a stable
 * context fingerprint for stale-result protection.
 *
 * The model PROPOSES; this decides validity. There is NO partial success and NO
 * deterministic fabrication. Only four fields are ever APPLIED to the canonical draft
 * (learning approach, completion question, Arena recommendation, follow-up timing);
 * every rationale / guidance / assumption / warning is advisory display only.
 *
 * No DB, no I/O, no providers.
 */

import {
  stepBlocker,
  normalizeLearningNeeds,
  LEARNING_NEEDS,
  MATERIAL_INTENTS,
  FOLLOW_UP_DAY_OPTIONS,
  COMPLETION_PROMPT_MAX,
  AUDIENCE_TYPES_NEEDING_DETAIL,
  type BuilderAnswers,
  type LearningNeed,
  type MaterialIntent,
  type FollowUpDays,
  type AudienceType,
} from "./module-builder";

export const MODULE_DRAFT_GENERATION_VERSION = "module_draft_copilot_v1";

// ---------------------------------------------------------------------------
// Minimum canonical generation context (the entry prerequisite)
// ---------------------------------------------------------------------------

/** The server-reconstructed context the draft is generated from. Capability is optional. */
export type ModuleDraftContext = {
  problemStatement: string;
  audienceType: AudienceType;
  audienceDetail: string | null;
  capabilityCandidate: string | null;
  recurringMoment: "at each handoff point",
  observableBehavior: string;
  successEvidence: string;
};

/**
 * Reconstruct the minimum canonical context, or null when it is not yet complete.
 * Reuses the EXACT Builder gate for steps 1–4 (problem, audience, behavior, evidence)
 * so the Copilot can never run on a draft the Builder itself would consider unready.
 */
export function moduleDraftContext(answers: BuilderAnswers | undefined): ModuleDraftContext | null {
  const a = answers ?? {};
  /*
    THE COPILOT'S MINIMUM CONTEXT, listed by MEANING not by range (Slice 3.2P-R3.6-R1).

    It was `[1,2,3,4]` — problem, audience, behaviour, evidence — back when those were steps
    1 to 4. Inserting the recurring moment at 3 moved behaviour and evidence to 4 and 5, and a
    range would silently have swapped "evidence" for "the moment". This assistant drafts module
    CONTENT and has never needed the occasion, so it keeps exactly the four it always had.
  */
  for (const step of [1, 2, 4, 5]) {
    if (stepBlocker(step, a)) return null;
  }
  const audienceType = a.audienceType as AudienceType;
  const needsDetail = (AUDIENCE_TYPES_NEEDING_DETAIL as readonly string[]).includes(audienceType);
  return {
    problemStatement: (a.problem ?? "").trim(),
    audienceType,
    audienceDetail: needsDetail ? (a.audienceDetail ?? "").trim() : null,
    capabilityCandidate: (a.capabilityCandidate ?? "").trim() || null,
    recurringMoment: "at each handoff point",
    observableBehavior: (a.observableBehavior ?? "").trim(),
    successEvidence: (a.successEvidence ?? "").trim(),
  };
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** A stable fingerprint of the canonical context — stale-result protection (§12). */
export function moduleDraftContextFingerprint(ctx: ModuleDraftContext): string {
  return [
    norm(ctx.problemStatement),
    ctx.audienceType,
    norm(ctx.audienceDetail ?? ""),
    norm(ctx.capabilityCandidate ?? ""),
    norm(ctx.observableBehavior),
    norm(ctx.successEvidence),
  ].join("¦");
}

/** Whether a client-supplied context matches the server-reconstructed one (anti-stale). */
export function moduleDraftContextsCompatible(a: ModuleDraftContext, b: ModuleDraftContext): boolean {
  return moduleDraftContextFingerprint(a) === moduleDraftContextFingerprint(b);
}

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

export type ModuleDraftMaterialGuidance = {
  recommended_types: MaterialIntent[];
  suggestion: string;
};

export type ModuleDraftSuggestion = {
  /** APPLIED → answers.learningNeeds */
  learning_approach: LearningNeed[];
  learning_approach_rationale: string;
  /** APPLIED → answers.completionPrompt */
  completion_question: string;
  /** APPLIED → answers.arenaRecommended */
  arena_recommended: boolean;
  arena_rationale: string;
  /** APPLIED → answers.followUpDays */
  follow_up_days: FollowUpDays;
  /** Advisory only — no canonical follow-up-guidance field exists. */
  follow_up_guidance: string;
  /** Advisory only — never applied, never claims an asset exists. */
  material_guidance: ModuleDraftMaterialGuidance;
};

export type ModuleDraftValidated = {
  module_draft: ModuleDraftSuggestion;
  assumptions: string[];
  warnings: string[];
};

export type ModuleDraftRejectCode =
  | "not_object"
  | "missing_module_draft"
  | "missing_field"
  | "field_type"
  | "empty_field"
  | "too_long"
  | "unsafe_markup"
  | "unsupported_learning_approach"
  | "unsupported_follow_up"
  | "invalid_material_type"
  | "completion_question_generic"
  | "overclaiming_evidence"
  | "material_fabrication"
  | "duplicate_field_content"
  | "invalid_assumptions"
  | "invalid_warnings";

export type ModuleDraftValidation =
  | { ok: true; value: ModuleDraftValidated }
  | { ok: false; code: ModuleDraftRejectCode };

// ---------------------------------------------------------------------------
// Length bounds (conservative, sized to the review UI + completion DB cap)
// ---------------------------------------------------------------------------

const LIMITS = {
  completion_question: COMPLETION_PROMPT_MAX, // 300 — same cap the event validator enforces
  rationale: 320,
  guidance: 320,
  material_suggestion: 320,
  assumption: 240,
  warning: 240,
} as const;

const MAX_ASSUMPTIONS = 6;
const MAX_WARNINGS = 6;

// ---------------------------------------------------------------------------
// Safety gates (lexical, fail-closed minimum floor — not semantic perfection)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const UNSAFE = [
  /<[^>]+>/, // html tag
  /```|~~~/, // markdown fence
  /data:\s*[\w.+-]+\/[\w.+-]+/i, // data url
  /<\s*script|javascript:|onerror\s*=|onload\s*=/i, // script-like
  /^\s*[[{][\s\S]*[\]}]\s*$/, // whole value is serialized JSON
];
function hasUnsafeMarkup(raw: string): boolean {
  return CONTROL_CHARS.test(raw) || UNSAFE.some((re) => re.test(raw));
}

const OVERCLAIM = new RegExp(
  [
    "now competent",
    "fully (understand|understood|understands)",
    "permanently",
    "trust (was|is|has been) restored",
    "behaviou?r (?:has |was )?(?:permanently )?changed",
    "mastered",
    "no longer needs?",
    "performance improved",
    "caused .{0,20}improvement",
    "guarantees?",
  ].join("|"),
  "i",
);

// Claims that a concrete asset / policy ALREADY exists (fabrication).
const MATERIAL_EXISTS = [
  /\bis attached\b/i,
  /\bhas been (attached|uploaded|added|created|approved)\b/i,
  /\balready (exists|attached|uploaded)\b/i,
  /\b(the|our|this|your) (?:(?:attached|uploaded|official|approved|existing|current)\s+){1,3}(file|document|policy|checklist|video|pdf|guide|manual|sop|procedure)\b/i,
  /\bwe (?:have|use) (?:a|an|the|our) (?:official |approved )?(policy|checklist|document|sop|procedure)\b/i,
];
function claimsMaterialExists(s: string): boolean {
  return MATERIAL_EXISTS.some((re) => re.test(s));
}

// Completion-question quality gates.
const WH_WORD = /\b(what|which|how|when|where|who|why|whom)\b|무엇|무슨|어떤|어떻게|언제|어디|누구|왜|얼마/i;
const GENERIC_COMPLETION = [
  /one thing you(?:'ll| will)? (?:apply|do|try)/i,
  /what did you learn/i,
  /how (?:did|do) you feel/i,
  /^\s*summar/i,
  /이번 주에 적용할 한 가지/,
  /무엇을 배웠나요/,
];
function isWeakCompletionQuestion(normalizedText: string, raw: string): boolean {
  if (normalizedText.length < 20) return true; // too short to be specific
  if (!WH_WORD.test(raw)) return true; // no interrogative → generic / yes-no
  if (GENERIC_COMPLETION.some((re) => re.test(raw))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, max: number): { ok: true; value: string } | { ok: false; code: ModuleDraftRejectCode } {
  if (typeof v !== "string") return { ok: false, code: "field_type" };
  if (hasUnsafeMarkup(v)) return { ok: false, code: "unsafe_markup" };
  const n = v.replace(/\s+/g, " ").trim();
  if (n.length === 0) return { ok: false, code: "empty_field" };
  if (n.length > max) return { ok: false, code: "too_long" };
  return { ok: true, value: n };
}

function cleanEnumArray<T extends string>(
  v: unknown,
  allowed: readonly T[],
  badCode: ModuleDraftRejectCode,
): { ok: true; value: T[] } | { ok: false; code: ModuleDraftRejectCode } {
  if (!Array.isArray(v) || v.length === 0) return { ok: false, code: badCode };
  const out: T[] = [];
  for (const item of v) {
    if (!(allowed as readonly string[]).includes(item as string)) return { ok: false, code: badCode };
    if (!out.includes(item as T)) out.push(item as T);
  }
  return { ok: true, value: out };
}

function cleanStringArray(
  v: unknown,
  max: number,
  maxCount: number,
  badCode: ModuleDraftRejectCode,
): { ok: true; value: string[] } | { ok: false; code: ModuleDraftRejectCode } {
  if (v === undefined || v === null) return { ok: true, value: [] };
  if (!Array.isArray(v) || v.length > maxCount) return { ok: false, code: badCode };
  const out: string[] = [];
  for (const item of v) {
    const c = cleanString(item, max);
    if (!c.ok) return { ok: false, code: c.code === "field_type" ? badCode : c.code };
    out.push(c.value);
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const REJECT = (code: ModuleDraftRejectCode): ModuleDraftValidation => ({ ok: false, code });

/**
 * Validate a raw parsed provider module draft. Fail-closed: any structural, enum,
 * length, markup, completion-quality, evidence-honesty, material-honesty, or
 * distinctness failure rejects the WHOLE draft with a stable code.
 */
export function validateModuleDraft(raw: unknown): ModuleDraftValidation {
  if (!isPlainObject(raw)) return REJECT("not_object");
  const md = raw.module_draft;
  if (!isPlainObject(md)) return REJECT("missing_module_draft");

  const required = [
    "learning_approach",
    "learning_approach_rationale",
    "completion_question",
    "arena_recommended",
    "arena_rationale",
    "follow_up_days",
    "follow_up_guidance",
    "material_guidance",
  ];
  for (const k of required) if (!(k in md)) return REJECT("missing_field");

  // learning_approach (enum array → applied to learningNeeds)
  const la = cleanEnumArray<LearningNeed>(md.learning_approach, LEARNING_NEEDS, "unsupported_learning_approach");
  if (!la.ok) return REJECT(la.code);

  // arena_recommended (boolean → applied)
  if (typeof md.arena_recommended !== "boolean") return REJECT("field_type");
  const arenaRecommended = md.arena_recommended;

  // follow_up_days (enum → applied)
  if (!(FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(md.follow_up_days as number)) {
    return REJECT("unsupported_follow_up");
  }
  const followUpDays = md.follow_up_days as FollowUpDays;

  // material_guidance (advisory)
  if (!isPlainObject(md.material_guidance)) return REJECT("field_type");
  const mt = cleanEnumArray<MaterialIntent>(md.material_guidance.recommended_types, MATERIAL_INTENTS, "invalid_material_type");
  if (!mt.ok) return REJECT(mt.code);
  const matSuggestion = cleanString(md.material_guidance.suggestion, LIMITS.material_suggestion);
  if (!matSuggestion.ok) return REJECT(matSuggestion.code);

  // text fields
  const laRationale = cleanString(md.learning_approach_rationale, LIMITS.rationale);
  if (!laRationale.ok) return REJECT(laRationale.code);
  const completion = cleanString(md.completion_question, LIMITS.completion_question);
  if (!completion.ok) return REJECT(completion.code);
  const arenaRationale = cleanString(md.arena_rationale, LIMITS.rationale);
  if (!arenaRationale.ok) return REJECT(arenaRationale.code);
  const followGuidance = cleanString(md.follow_up_guidance, LIMITS.guidance);
  if (!followGuidance.ok) return REJECT(followGuidance.code);

  // completion-question quality
  if (isWeakCompletionQuestion(norm(completion.value), completion.value)) return REJECT("completion_question_generic");

  // evidence honesty (completion + guidance + arena rationale)
  for (const s of [completion.value, followGuidance.value, arenaRationale.value]) {
    if (OVERCLAIM.test(s)) return REJECT("overclaiming_evidence");
  }

  // material honesty — no field may claim a concrete asset/policy already exists
  for (const s of [completion.value, followGuidance.value, arenaRationale.value, laRationale.value, matSuggestion.value]) {
    if (claimsMaterialExists(s)) return REJECT("material_fabrication");
  }

  // distinct field purpose — the same generic sentence must not fill multiple slots
  const purposeKeys = [completion.value, followGuidance.value, arenaRationale.value, matSuggestion.value].map(norm);
  for (let i = 0; i < purposeKeys.length; i++) {
    for (let j = i + 1; j < purposeKeys.length; j++) {
      if (purposeKeys[i] === purposeKeys[j]) return REJECT("duplicate_field_content");
    }
  }

  const assumptions = cleanStringArray(raw.assumptions, LIMITS.assumption, MAX_ASSUMPTIONS, "invalid_assumptions");
  if (!assumptions.ok) return REJECT(assumptions.code);
  const warnings = cleanStringArray(raw.warnings, LIMITS.warning, MAX_WARNINGS, "invalid_warnings");
  if (!warnings.ok) return REJECT(warnings.code);

  return {
    ok: true,
    value: {
      module_draft: {
        learning_approach: la.value,
        learning_approach_rationale: laRationale.value,
        completion_question: completion.value,
        arena_recommended: arenaRecommended,
        arena_rationale: arenaRationale.value,
        follow_up_days: followUpDays,
        follow_up_guidance: followGuidance.value,
        material_guidance: { recommended_types: mt.value, suggestion: matSuggestion.value },
      },
      assumptions: assumptions.value,
      warnings: warnings.value,
    },
  };
}

/** The canonical patch a review can apply. Every key optional (only "Use" fields). */
export type ModuleDraftPatch = Partial<{
  learningNeeds: LearningNeed[];
  completionPrompt: string;
  arenaRecommended: boolean;
  followUpDays: FollowUpDays;
}>;

/** Re-exported so callers can render current learning approach without re-deriving. */
export { normalizeLearningNeeds };
