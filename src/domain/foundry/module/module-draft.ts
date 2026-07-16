/**
 * Foundry Guided Module Builder — domain (pure).
 *
 * No DB, no crypto, no I/O. Just the rules that decide what a valid module draft
 * is, how its lifecycle may transition, and the deterministic quality/honesty
 * gates the builder applies. Persistence, ownership, and token/asset lifecycle
 * live in the service layer (`src/lib/bty/foundry/events/foundryModuleService`).
 *
 * Product framing: a Module captures a manager's intent —
 *   problem -> capability -> target roles -> observable behavior ->
 *   success evidence -> learning material -> practice recommendation -> follow-up.
 * V1 is MANUAL-FIRST: every rule here is deterministic and provider-free. The
 * assistive drafting layer (later slice) may only ever propose DRAFT text; it can
 * never approve or publish. Nothing here calls a provider.
 */

import type { ValidationResult } from "../events/foundry-event";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * The three — and only three — states a module draft may hold in V1.
 * `review`, `revised`, and `retired` are deliberately DEFERRED.
 */
export type ModuleDraftStatus = "draft" | "approved" | "published";

export const MODULE_DRAFT_STATUSES: readonly ModuleDraftStatus[] = [
  "draft",
  "approved",
  "published",
];

/**
 * The single allowed forward path. There is no backward transition and no skip:
 * a revision of an approved/published module is a NEW draft (see nextModuleVersion),
 * never a mutation of the frozen one. `published` is terminal.
 */
const LIFECYCLE_TRANSITIONS: Readonly<Record<ModuleDraftStatus, readonly ModuleDraftStatus[]>> = {
  draft: ["approved"],
  approved: ["published"],
  published: [],
};

/** Whether `from -> to` is a legal lifecycle transition. Self-transitions are not legal. */
export function canTransition(from: ModuleDraftStatus, to: ModuleDraftStatus): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * A draft's editable content (current_step / answers / document_asset_ref) may be
 * mutated or deleted ONLY while it is still a draft. Once approved it is immutable.
 */
export function canMutateDraft(status: ModuleDraftStatus): boolean {
  return status === "draft";
}

/** Publishing is allowed only from an approved draft (publish itself is a later slice). */
export function canPublish(status: ModuleDraftStatus): boolean {
  return status === "approved";
}

/** A revision bumps the module version. Guards against a corrupt/absent current value. */
export function nextModuleVersion(current: number): number {
  if (!Number.isInteger(current) || current < 1) return 1;
  return current + 1;
}

// ---------------------------------------------------------------------------
// Learning type -> Arena practice recommendation (deterministic in V1)
// ---------------------------------------------------------------------------

export type LearningType =
  | "policy"
  | "informational"
  | "judgment"
  | "conversation"
  | "conflict"
  | "handoff"
  | "escalation"
  | "leadership"
  | "decision_under_pressure";

export const LEARNING_TYPES: readonly LearningType[] = [
  "policy",
  "informational",
  "judgment",
  "conversation",
  "conflict",
  "handoff",
  "escalation",
  "leadership",
  "decision_under_pressure",
];

/**
 * Practice (Arena) is recommended when the learning involves judgment, live
 * conversation, conflict, a handoff/escalation, leadership, or a decision under
 * pressure — anything that only forms under repeated, varied pressure. It is NOT
 * recommended for simple policy or informational content (reading/acknowledging
 * is enough). This is a deterministic mapping, not a suggestion, in V1.
 */
export const ARENA_RECOMMENDED_LEARNING_TYPES: readonly LearningType[] = [
  "judgment",
  "conversation",
  "conflict",
  "handoff",
  "escalation",
  "leadership",
  "decision_under_pressure",
];

export function isLearningType(raw: unknown): raw is LearningType {
  return typeof raw === "string" && (LEARNING_TYPES as readonly string[]).includes(raw);
}

/** Deterministic: does this learning type warrant an Arena practice recommendation? */
export function recommendArena(learningType: unknown): boolean {
  return (
    isLearningType(learningType) &&
    (ARENA_RECOMMENDED_LEARNING_TYPES as readonly string[]).includes(learningType)
  );
}

// ---------------------------------------------------------------------------
// Evidence Ladder honesty (deterministic guard)
// ---------------------------------------------------------------------------

/**
 * The Evidence Ladder, low -> high. Higher rungs are stronger claims about real
 * behavior change. The honesty rule: completion or self-report can NEVER be
 * labeled as verified behavior change (the top three rungs) — only a human
 * observation can. This mirrors the Arena invariant that a run is
 * `complete_verified` only when a human approves + verified_at is set.
 */
export const EVIDENCE_LADDER = [
  "exposed",
  "reflected",
  "decided",
  "practiced",
  "applied",
  "observed",
  "sustained",
] as const;

export type EvidenceLevel = (typeof EVIDENCE_LADDER)[number];

/** The rungs that constitute a claim of verified behavior change in the field. */
export const VERIFIED_BEHAVIOR_LEVELS: readonly EvidenceLevel[] = ["applied", "observed", "sustained"];

/** Where an evidence claim comes from. */
export type EvidenceSource = "completion" | "self_report" | "system_practice" | "manager_observation";

export const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  "completion",
  "self_report",
  "system_practice",
  "manager_observation",
];

export function isEvidenceLevel(raw: unknown): raw is EvidenceLevel {
  return typeof raw === "string" && (EVIDENCE_LADDER as readonly string[]).includes(raw);
}

export function isEvidenceSource(raw: unknown): raw is EvidenceSource {
  return typeof raw === "string" && (EVIDENCE_SOURCES as readonly string[]).includes(raw);
}

export function isVerifiedBehaviorLevel(level: EvidenceLevel): boolean {
  return (VERIFIED_BEHAVIOR_LEVELS as readonly string[]).includes(level);
}

/**
 * The honesty matrix. What each source is allowed to claim:
 *   - completion / self_report : up to 'decided' only (exposed | reflected | decided).
 *   - system_practice          : up to 'practiced' (Arena observed the practice).
 *   - manager_observation      : any rung, including the verified-behavior tier.
 * Anything higher for a weaker source is an overclaim.
 */
export function evidenceSourceCanClaim(source: EvidenceSource, level: EvidenceLevel): boolean {
  if (isVerifiedBehaviorLevel(level)) return source === "manager_observation";
  if (level === "practiced") return source === "system_practice" || source === "manager_observation";
  // exposed | reflected | decided — reachable by any source.
  return true;
}

/**
 * Reject labeling completion/self-report as verified behavior change. Returns the
 * validated level on success, or a stable machine reason on an overclaim.
 */
export function validateEvidenceHonesty(
  rawLevel: unknown,
  rawSource: unknown,
): ValidationResult<{ level: EvidenceLevel; source: EvidenceSource }> {
  if (!isEvidenceLevel(rawLevel)) return { ok: false, reason: "evidence_level_invalid" };
  if (!isEvidenceSource(rawSource)) return { ok: false, reason: "evidence_source_invalid" };
  if (!evidenceSourceCanClaim(rawSource, rawLevel)) return { ok: false, reason: "evidence_overclaim" };
  return { ok: true, value: { level: rawLevel, source: rawSource } };
}

// ---------------------------------------------------------------------------
// Observable-behavior quality (deterministic WARNING, not a hard block)
// ---------------------------------------------------------------------------

/**
 * Vague outcome phrases that are not observable behavior. Matched case-insensitively
 * as substrings. This is a heuristic denylist — it can miss novel vague phrasings
 * (false negatives), so it produces a WARNING, never a hard rejection.
 */
export const VAGUE_BEHAVIOR_PHRASES: readonly string[] = [
  "communicate better",
  "be more responsible",
  "improve teamwork",
  "be more positive",
  "show leadership",
  "have a good attitude",
  "be more professional",
  "take ownership",
  "be more proactive",
  "be a team player",
];

/**
 * Warn when an observable-behavior statement reads as a vague trait rather than an
 * observable act. Heuristic: a known vague phrase, or too few words to carry an
 * actor + observable verb + a context/result. Returns a machine warning code or
 * null when it looks specific enough. NOT authoritative — guidance only.
 */
export function observableBehaviorWarning(raw: unknown): string | null {
  if (typeof raw !== "string") return "observable_behavior_missing";
  const text = raw.trim();
  if (text.length < 1) return "observable_behavior_missing";
  const lower = text.toLowerCase();
  for (const phrase of VAGUE_BEHAVIOR_PHRASES) {
    if (lower.includes(phrase)) return "observable_behavior_vague";
  }
  // A concrete behavior usually names an actor, an observable verb, and a
  // trigger/result — hard to express in three words. Below that, warn.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return "observable_behavior_vague";
  return null;
}

// ---------------------------------------------------------------------------
// Module draft validation (approval-readiness)
// ---------------------------------------------------------------------------

/**
 * The builder answer set. Progressive: a draft may hold a partial object while
 * being edited. Fields are validated for completeness only at approval time.
 */
export type ModuleDraftAnswers = {
  /** 1. What needs to change? */
  problem?: string;
  /** 2/1b. The capability the change implies. */
  capability?: string;
  /** 2. Who needs to do something differently? (>= 1 role) */
  targetRoles?: string[];
  /** 3. What should they do differently? */
  observableBehavior?: string;
  /** 4. What would you see or hear if it happened? */
  successEvidence?: string;
  /** Which rung of the Evidence Ladder this evidence sits on. */
  evidenceLevel?: EvidenceLevel;
  /** Where that evidence comes from (governs the honesty gate). */
  evidenceSource?: EvidenceSource;
  /** 5. What kind of learning is needed? */
  learningType?: LearningType;
  /** Reflection prompt shown to the participant. */
  reflectionPrompt?: string;
  /** Action-decision prompt shown to the participant. */
  actionDecisionPrompt?: string;
  /** 7. Is practice needed? (defaults are derived, but the host may confirm.) */
  arenaRecommended?: boolean;
  /** 7. Follow-up setting (opaque in V1 — presence only). */
  followUp?: unknown;
};

export type ModuleDraftValidation = {
  ok: boolean;
  /** Blocking problems — approval is refused while any exist. */
  errors: string[];
  /** Non-blocking guidance — surfaced, but does not block approval. */
  warnings: string[];
};

const REQUIRED_TEXT_FIELDS: ReadonlyArray<{ key: keyof ModuleDraftAnswers; error: string }> = [
  { key: "problem", error: "problem_required" },
  { key: "capability", error: "capability_required" },
  { key: "observableBehavior", error: "observable_behavior_required" },
  { key: "successEvidence", error: "success_evidence_required" },
  { key: "reflectionPrompt", error: "reflection_prompt_required" },
  { key: "actionDecisionPrompt", error: "action_decision_prompt_required" },
];

function isNonEmptyText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate a module draft for approval-readiness. Deterministic and pure.
 * Errors block approval; warnings are advisory (vague behavior, evidence-source
 * mismatch is an ERROR because overclaiming verified behavior is a hard honesty
 * violation, not mere guidance).
 */
export function validateModuleDraft(answers: ModuleDraftAnswers | undefined): ModuleDraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const a = answers ?? {};

  for (const f of REQUIRED_TEXT_FIELDS) {
    if (!isNonEmptyText(a[f.key])) errors.push(f.error);
  }

  if (!Array.isArray(a.targetRoles) || a.targetRoles.filter((r) => isNonEmptyText(r)).length < 1) {
    errors.push("target_roles_required");
  }

  // Learning requirement is satisfied by the legacy single learningType OR the
  // Slice-2.1 canonical learningNeeds array (a training may need several). Approval
  // itself is a later slice; this only teaches the validator the array shape.
  const learningNeeds = (a as { learningNeeds?: unknown }).learningNeeds;
  const legacyNeed = (a as { learningNeed?: unknown }).learningNeed;
  const hasNeeds =
    (Array.isArray(learningNeeds) && learningNeeds.length > 0) || typeof legacyNeed === "string";
  if (!isLearningType(a.learningType) && !hasNeeds) {
    errors.push("learning_type_required");
  }

  // Observable-behavior quality is a WARNING (heuristic), never a hard block.
  const behaviorWarn = observableBehaviorWarning(a.observableBehavior);
  if (behaviorWarn === "observable_behavior_vague") warnings.push(behaviorWarn);

  // Evidence honesty. Only evaluated once both level + source are present. An
  // overclaim (e.g. completion labeled 'applied'/'observed'/'sustained') is a
  // hard ERROR: verified behavior change must never be self-reported.
  if (a.evidenceLevel !== undefined || a.evidenceSource !== undefined) {
    const honesty = validateEvidenceHonesty(a.evidenceLevel, a.evidenceSource);
    if (!honesty.ok) errors.push(honesty.reason);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Approval is allowed only from a `draft` whose answers pass validation. Combines
 * the lifecycle guard with the content gate so a caller has one truthy check.
 */
export function canApprove(status: ModuleDraftStatus, answers: ModuleDraftAnswers | undefined): boolean {
  return status === "draft" && validateModuleDraft(answers).ok;
}
