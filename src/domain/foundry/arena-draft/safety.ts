/**
 * Foundry Practice — safety eligibility + constraint compliance (pure) [Slice 3.2I-R3].
 *
 * A mandatory safety/legal/privacy/clinical/compliance boundary is NOT one side of a
 * difficult choice — it is the floor beneath every legitimate choice. This module
 * classifies whether a training is eligible for judgment Practice, and (for mixed
 * content) rejects any generated scenario that presents violating a non-negotiable rule
 * as a defensible option. Deterministic + layered; text matching NEVER claims to
 * guarantee safety — it fails safe when the boundary is ambiguous. No DB, no I/O.
 */

import type { ArenaScenarioDraft } from "./types";

/** Minimal training signal the classifier reads (mapped from module facts by the service). */
export type SafetyClassificationInput = {
  problem?: string | null;
  observableBehavior?: string | null;
  successEvidence?: string | null;
  learningNeeds?: string[];
};

export type PracticeEligibility = {
  kind: "know_only" | "judgment_only" | "mixed_with_non_negotiables" | "unresolved_safety_boundary";
  /** Extracted non-negotiable constraint statements (mixed content only). Internal use. */
  constraints: string[];
};

// A hard-constraint DOMAIN (privacy/clinical/legal/compliance/report), not generic topic words. (en + ko)
const CONSTRAINT_DOMAIN =
  /\b(patient|medication|dose|dosage|identifier|identit|privacy|private|confidential|consent|clinical|legal|complian|regulat|mandatory|hazard|safety|steril|contraindicat|prohibit|disclos|incident|report)\b|환자|신원|투약|약물|치료|개인정보|기밀|규정|법적|준수|사고|보고|안전|위험/i;

// A MANDATE modal — turns a domain mention into a stated hard rule. (en + ko)
const MANDATE_MODAL =
  /\b(must|shall|required?|before |prior to|never |always |do not|don'?t|mandatory|may not|is not allowed|not permitted)\b|반드시|해야\s*한다|필수|하지\s*(말|않아야|않는다)|금지|해선\s*안|전에\s*(반드시|먼저)|먼저\s*확인/i;

/** Sentences that carry BOTH a constraint domain and a mandate — the non-negotiable rules. */
function extractConstraints(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && CONSTRAINT_DOMAIN.test(s) && MANDATE_MODAL.test(s));
}

/**
 * Classify practice eligibility. Layered: (1) learningNeeds; (2) explicit mandate language
 * in the training facts; (3) fail safe when a constraint domain appears WITHOUT a clear
 * mandate (ambiguous). A live provider may refine this further, but must never override an
 * explicit structured KNOW-only signal. Pure.
 */
export function classifyPracticeEligibility(input: SafetyClassificationInput): PracticeEligibility {
  const needs = input.learningNeeds ?? [];
  const knowOnly = needs.length > 0 && needs.every((n) => n === "know");

  const text = [input.problem, input.observableBehavior, input.successEvidence]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(". ");

  const hasDomain = CONSTRAINT_DOMAIN.test(text);
  const hasMandate = MANDATE_MODAL.test(text);
  const constraints = extractConstraints(text);

  // KNOW-only content is a confirmation check, never a judgment dilemma.
  if (knowOnly) return { kind: "know_only", constraints };

  // A hard-constraint domain WITHOUT a clear mandate is ambiguous → fail safe.
  if (hasDomain && !hasMandate) return { kind: "unresolved_safety_boundary", constraints: [] };

  // A hard-constraint domain WITH a mandate → generate only inside the safe boundary.
  if (hasDomain && hasMandate && constraints.length > 0) {
    return { kind: "mixed_with_non_negotiables", constraints };
  }
  // Domain + mandate present but no clean constraint sentence extracted → still ambiguous.
  if (hasDomain && hasMandate) return { kind: "unresolved_safety_boundary", constraints: [] };

  return { kind: "judgment_only", constraints: [] };
}

// ---------------------------------------------------------------------------
// Constraint-compliance validator — no generated choice may violate a mandate.
// ---------------------------------------------------------------------------

/** Choice wording that presents NON-COMPLIANCE as a selectable option (en + ko). */
const VIOLATION_PATTERNS: readonly RegExp[] = [
  /\bskip\b.{0,30}\b(check|verification|identifier|step|report|confirmation|verify|dose|screening)\b/i,
  /\b(without|before)\b.{0,20}\b(verif|confirm|check|clearing|completing|screening)\b/i,
  /\bproceed\b.{0,20}\b(without|before)\b/i,
  /\bbypass\b.{0,20}\b(check|verification|rule|policy|standard|protocol|screening)\b/i,
  /\b(don'?t|do not|never)\b.{0,20}\b(verify|confirm|check|report|screen)\b/i,
  /\b(hide|bury|withhold|suppress)\b.{0,20}\b(report|incident|error|mistake|concern)\b/i,
  /\b(don'?t|do not)\b.{0,10}\breport\b/i,
  /\b(disclose|reveal|leak|share)\b.{0,20}\b(private|confidential|personal|patient|employee)\b/i,
  /\bforgo\b.{0,20}\b(check|verification|report|screening)\b/i,
  /확인.{0,4}건너|검증.{0,4}생략|보고.{0,6}(안|하지\s*않)|규정.{0,4}무시|공개(해선|하면\s*안|한다)|먼저\s*확인하지\s*않/,
];

export type ConstraintValidation = { ok: boolean; errors: string[] };

function allLabels(draft: ArenaScenarioDraft): string[] {
  const out = [
    ...draft.primary.choices,
    ...draft.tradeoff.choices,
    ...draft.actionDecision.choices,
  ].map((c) => c.label);
  for (const b of Object.values(draft.branches ?? {})) {
    out.push(...b.tradeoffChoices.map((c) => c.label), ...b.actionDecision.choices.map((c) => c.label));
  }
  return out;
}

/**
 * Reject a draft in which any choice presents violating a non-negotiable constraint as a
 * defensible option (Slice 3.2I-R3). Heuristic deterministic protection — a layer, not a
 * guarantee. `constraints` is advisory context; the violation patterns are constraint-kind
 * agnostic so a bare "skip the check" fails regardless. Pure.
 */
export function validateConstraintCompliance(draft: ArenaScenarioDraft): ConstraintValidation {
  const errors: string[] = [];
  for (const label of allLabels(draft)) {
    if (VIOLATION_PATTERNS.some((re) => re.test(label))) {
      errors.push("constraint_violation");
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}
