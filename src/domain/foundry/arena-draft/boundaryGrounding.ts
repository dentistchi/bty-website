/**
 * CONFIRMED-BOUNDARY GROUNDING (Slice 3.2I-R5B1A.1-R2.21).
 *
 * THE MEASURED DEFECT
 *
 * c18 confirms one rule — "Two identifiers must be verified before treatment" — and the generated
 * scenario never mentioned it. No choice touched identity verification at all, so "no choice
 * violates the rule" was trivially true, every per-choice `constraintAssessment` said `satisfied`,
 * the reviewer's single `boundaryCompliant` boolean said true, and the scenario was accepted.
 *
 * That is VACUOUS COMPLIANCE: silence about a boundary is not compliance. The rehearsal the Manager
 * asked for — practising judgment while the rule holds — never happened.
 *
 * WHERE IT WAS LOST (measured, see BOUNDARY DATA FLOW in the slice report)
 *
 * The boundary DATA was never lost. Its id and statement reach the generator prompt
 * (`- [id] statement`) and the reviewer payload (`{id, statement}`) intact. What no contract in the
 * chain could EXPRESS was presence and operational effect:
 *   - the provider schema's assessment `status` enum is `["satisfied"]` — a violation is literally
 *     unrepresentable, so the assessment is self-attestation, not evidence;
 *   - `validateConstraintAssessments` only checks that the model SAID satisfied for every id;
 *   - the reviewer had one global `boundaryCompliant` boolean, with no field for "is the rule in the
 *     scenario" or "does it constrain any decision".
 * Compliance was expressible everywhere. Presence and operational effect were expressible nowhere.
 *
 * WHAT THIS MODULE ADDS
 *
 * A provider-facing grounding declaration per confirmed boundary, plus the deterministic gate over
 * it. The gate enforces NECESSARY conditions only — coverage, statement fidelity, declared
 * operational effect, and lexical evidence that the rule reaches the scenario at all. Lexical
 * evidence is never sufficient: the independent semantic reviewer (see `semanticReview.ts`) judges
 * whether the rule actually constrains the decisions, and a model self-attestation alone can never
 * produce an accept.
 *
 * Pure domain: no I/O, no provider, no DB. Never rewrites a scenario.
 */

import type { ArenaScenarioDraft } from "./types";
import type { BoundaryConstraint } from "./boundary";

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/** Grounding defects. Every one of these fails closed. */
export const BOUNDARY_DEFECT_CODES = [
  "confirmed_boundary_absent",
  "boundary_not_operationalized",
  "vacuous_boundary_compliance",
  "choice_bypasses_boundary",
  "branch_drops_boundary",
  "action_reopens_boundary",
  "unknown_boundary_reference",
  "missing_boundary_reference",
] as const;
export type BoundaryDefectCode = (typeof BOUNDARY_DEFECT_CODES)[number];

/** Structural faults in the declaration itself, distinct from the product defects above. */
export const BOUNDARY_GROUNDING_STRUCTURAL_CODES = [
  "grounding_missing",
  "grounding_malformed",
  "grounding_duplicate_boundary",
  "grounding_statement_altered",
  "grounding_missing_remaining_judgment",
] as const;

/**
 * Where a boundary can bite. `opening` establishes it; the rest are DECISION stages — a rule that
 * affects only the opening is decoration, which is exactly the vacuous-compliance failure.
 */
export const DECISION_STAGES = ["opening", "primary", "flat_tradeoff", "flat_action", "branch_tradeoff", "branch_action"] as const;
export type DecisionStage = (typeof DECISION_STAGES)[number];
export const OPERATIVE_STAGES: readonly DecisionStage[] = DECISION_STAGES.filter((s) => s !== "opening");

// ---------------------------------------------------------------------------
// The provider-facing declaration
// ---------------------------------------------------------------------------

export type ProviderBoundaryGrounding = {
  /** MUST be one of the Manager-confirmed constraint ids. The model never invents one. */
  boundaryId: string;
  /** The confirmed rule restated. Must stay semantically faithful — it may not be weakened. */
  boundaryStatement: string;
  /** Where and how the rule is made operative in learner-facing text. */
  scenarioPresence: string;
  /** What the rule forces or forbids in the decisions themselves. */
  operationalEffect: string;
  affectedDecisionStages: DecisionStage[];
  /** The tempting option the rule takes off the table (so it is visibly excluded, not ignored). */
  prohibitedAlternativeExcluded: string;
  /** What genuine judgment survives inside the rule. Empty means there was nothing to rehearse. */
  remainingJudgmentDimensions: string[];
};

const strArray = { type: "array", items: { type: "string" } } as const;

/** Strict schema fragment — composed into the provider scenario schema. */
export const BOUNDARY_GROUNDING_JSON_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      boundaryId: { type: "string" },
      boundaryStatement: { type: "string" },
      scenarioPresence: { type: "string" },
      operationalEffect: { type: "string" },
      affectedDecisionStages: { type: "array", items: { type: "string", enum: DECISION_STAGES } },
      prohibitedAlternativeExcluded: { type: "string" },
      remainingJudgmentDimensions: strArray,
    },
    required: [
      "boundaryId",
      "boundaryStatement",
      "scenarioPresence",
      "operationalEffect",
      "affectedDecisionStages",
      "prohibitedAlternativeExcluded",
      "remainingJudgmentDimensions",
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Coarse lexical matching — a NECESSARY condition, never sufficient proof
// ---------------------------------------------------------------------------

/**
 * Words carried by every rule regardless of subject. Matching on them would make any scenario look
 * grounded, so they are excluded from the evidence set.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "to", "of", "in", "on", "at", "by", "for",
  "with", "from", "as", "it", "its", "not", "no", "must", "should", "shall", "may", "can", "will",
  "do", "does", "did", "have", "has", "had", "you", "your", "we", "our", "they", "their", "he",
  "she", "him", "her", "all", "any", "each", "every", "before", "after", "when", "while", "during",
  "always", "never", "only", "also", "into", "out", "up", "down", "over", "under", "such", "same",
]);

/**
 * Coarse morphological key: lowercase, trailing `y`→`i`, truncated to five characters. Deliberately
 * blunt — it must equate verify/verified/verification and identity/identifier/identifiers without a
 * stemmer. It over-matches related words, which is the safe direction: it can only make a rule look
 * PRESENT, and presence alone never produces an accept.
 */
export function boundaryTokenKey(word: string): string {
  const w = word.toLowerCase().replace(/y$/, "i");
  return w.length <= 5 ? w : w.slice(0, 5);
}

/** Content-word keys of a text, stopwords and punctuation removed. */
export function boundaryTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    out.add(boundaryTokenKey(raw));
  }
  return out;
}

/** How many of a rule's content words appear in a text, and how many the rule has. */
function evidence(statement: string, text: string): { hits: number; needed: number } {
  const rule = boundaryTokens(statement);
  const hay = boundaryTokens(text);
  let hits = 0;
  for (const t of rule) if (hay.has(t)) hits++;
  // 40% of the rule's content words, at least two — one shared common word is not evidence.
  const needed = Math.max(2, Math.ceil(rule.size * 0.4));
  return { hits, needed: Math.min(needed, Math.max(1, rule.size)) };
}

/** Learner-facing text split into the stage that ESTABLISHES a rule and the stages it must BITE. */
export function learnerFacingSurfaces(draft: ArenaScenarioDraft): { opening: string; decisions: string } {
  const decisions = [
    ...draft.primary.choices.map((c) => c.label),
    draft.tradeoff.escalationText,
    ...draft.tradeoff.choices.map((c) => c.label),
    draft.actionDecision.prompt,
    ...draft.actionDecision.choices.map((c) => c.label),
    ...Object.values(draft.branches ?? {}).flatMap((b) => [
      b.resultingWorldState ?? "",
      b.escalationText,
      ...b.tradeoffChoices.map((c) => c.label),
      b.actionDecision.prompt,
      ...b.actionDecision.choices.map((c) => c.label),
    ]),
  ].join(" ");
  return { opening: `${draft.title} ${draft.opening}`, decisions };
}

// ---------------------------------------------------------------------------
// The deterministic gate
// ---------------------------------------------------------------------------

export type GroundingValidation = { ok: boolean; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * Validate the provider's grounding declaration against the CONFIRMED constraints and the scenario
 * it claims to ground.
 *
 * Fail-closed on every defect. This gate proves NECESSARY conditions:
 *   - exactly one declaration per confirmed id, no unknown ids, no duplicates;
 *   - the restated rule is still the confirmed rule;
 *   - the declaration names a real operational effect at a real DECISION stage;
 *   - the rule's own vocabulary actually reaches the scenario, and reaches it beyond the opening.
 *
 * It does NOT prove the rule genuinely constrains the judgment — that is the independent reviewer's
 * job, and no amount of lexical evidence substitutes for it.
 */
export function validateBoundaryGrounding(
  raw: unknown,
  constraints: BoundaryConstraint[],
  draft: ArenaScenarioDraft,
): GroundingValidation {
  const errors: string[] = [];
  // No confirmed boundary → nothing to ground. An unsolicited declaration is still rejected.
  if (constraints.length === 0) {
    if (Array.isArray(raw) && raw.length > 0) errors.push("unknown_boundary_reference");
    return { ok: errors.length === 0, errors };
  }
  if (!Array.isArray(raw)) return { ok: false, errors: ["grounding_missing"] };

  const byId = new Map<string, BoundaryConstraint>(constraints.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const { opening, decisions } = learnerFacingSurfaces(draft);

  for (const entry of raw) {
    if (!isObj(entry) || !nonEmpty(entry.boundaryId)) {
      errors.push("grounding_malformed");
      continue;
    }
    const id = entry.boundaryId.trim();
    const confirmed = byId.get(id);
    if (!confirmed) {
      errors.push("unknown_boundary_reference");
      continue;
    }
    if (seen.has(id)) {
      errors.push("grounding_duplicate_boundary");
      continue;
    }
    seen.add(id);

    // 1. FIDELITY — the restated rule must still be the confirmed rule, not a softened paraphrase.
    if (!nonEmpty(entry.boundaryStatement)) errors.push("grounding_statement_altered");
    else {
      const f = evidence(confirmed.statement, entry.boundaryStatement);
      if (f.hits < f.needed) errors.push("grounding_statement_altered");
    }

    // 2. OPERATIONAL DECLARATION — named effect, named excluded alternative, real decision stages.
    if (!nonEmpty(entry.scenarioPresence) || !nonEmpty(entry.operationalEffect) || !nonEmpty(entry.prohibitedAlternativeExcluded)) {
      errors.push("boundary_not_operationalized");
    }
    const stages = Array.isArray(entry.affectedDecisionStages)
      ? entry.affectedDecisionStages.filter((s): s is DecisionStage => (DECISION_STAGES as readonly string[]).includes(s as string))
      : [];
    if (!stages.some((s) => OPERATIVE_STAGES.includes(s))) errors.push("boundary_not_operationalized");

    // 3. REMAINING JUDGMENT — a rule that leaves nothing to decide should have been no-safe.
    const remaining = Array.isArray(entry.remainingJudgmentDimensions)
      ? entry.remainingJudgmentDimensions.filter((d): d is string => nonEmpty(d))
      : [];
    if (remaining.length === 0) errors.push("grounding_missing_remaining_judgment");

    // 4. PRESENCE — the rule's own vocabulary must reach the learner-facing scenario at all.
    //    THIS is the c18 failure: the rule existed only in the prompt and the declaration.
    const whole = evidence(confirmed.statement, `${opening} ${decisions}`);
    if (whole.hits < whole.needed) {
      errors.push("confirmed_boundary_absent");
      continue; // absent subsumes vacuity — reporting both would be noise
    }

    // 5. VACUITY — established in the opening but touching no decision surface means the scenario
    //    would be byte-for-byte unchanged if the rule were deleted.
    const inDecisions = evidence(confirmed.statement, decisions);
    if (inDecisions.hits < inDecisions.needed) errors.push("vacuous_boundary_compliance");
  }

  for (const c of constraints) if (!seen.has(c.id)) errors.push("missing_boundary_reference");

  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}
