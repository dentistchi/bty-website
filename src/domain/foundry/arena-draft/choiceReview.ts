/**
 * ALL-PHASE CHOICE REVIEW + VAGUE-REASSURANCE CONTRACT (Slice 3.2I-R5B1A.1-R2.22).
 *
 * THE MEASURED GAP
 *
 * The semantic reviewer's per-choice contract covered PRIMARY choices only. Tradeoff and action
 * choices — flat and branched — were never individually judged, so c01's follow-ups ("Suggest they
 * trust your timeline without further explanation", "Continue to deflect questions", "Insist on
 * presenting the temporary solution to pacify the client") and c18's repeated vague reassurance
 * reached the learner on label plausibility alone.
 *
 * A good primary choice does not license a defective tradeoff or action. The same standard applies
 * at every phase: a competent, well-intentioned person must be able to choose it.
 *
 * VAGUE REASSURANCE is the specific measured pattern: a response that reduces a stakeholder's
 * concern without making a real decision — progress promised with no owner, action, threshold or
 * next step; ambiguity used only to buy time. It is NOT the same as a deliberately limited
 * disclosure required by privacy or incomplete verification, nor a justified pause that protects
 * accuracy or safety, nor a concise update with a clear next checkpoint. Those are legitimate
 * strategies and must stay available.
 *
 * Pure domain: this module defines what an all-phase review must say and when it contradicts
 * itself. It never rewrites a scenario.
 */

import { CHOICE_PHASES, type ChoicePhase, type ChoiceRef } from "./choiceConstruction";
import { GEN_REVIEW_TEXT_MAX } from "./types";

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/** Reasons a choice fails at ANY phase. The first six are the pre-existing primary-phase set. */
export const PHASE_CHOICE_DEFECT_CODES = [
  "no_legitimate_value",
  "bad_faith_option",
  "moral_decoy",
  "dominated_choice",
  "obvious_correct_answer",
  "unsafe_option",
  "vague_evasion",
  "duplicate_tradeoff",
  // R2.22 — measured in accepted live output.
  "vague_reassurance",
  "false_reassurance",
  "non_commitment_decoy",
  "passive_delay",
  "deflection_without_value",
  "repeated_decoy_across_branches",
] as const;
export type PhaseChoiceDefectCode = (typeof PHASE_CHOICE_DEFECT_CODES)[number];

/** Any of these on a visible choice makes an overall accept impossible. */
export const DISQUALIFYING_CHOICE_CODES: readonly string[] = [
  "bad_faith_option",
  "moral_decoy",
  "dominated_choice",
  "unsafe_option",
  "vague_evasion",
  "vague_reassurance",
  "false_reassurance",
  "non_commitment_decoy",
  "passive_delay",
  "deflection_without_value",
  "repeated_decoy_across_branches",
  "obvious_correct_answer",
  "no_legitimate_value",
];

// ---------------------------------------------------------------------------
// The per-choice review
// ---------------------------------------------------------------------------

export type PhaseChoiceReview = {
  phase: ChoicePhase;
  /** -1 for the flat phases. */
  branchIndex: number;
  choiceIndex: number;
  legitimateValue: string;
  acceptedCost: string;
  competentIntent: string;
  actionable: boolean;
  defensible: boolean;
  dominatedBySibling: boolean;
  badFaith: boolean;
  vagueReassurance: boolean;
  nonCommitmentDecoy: boolean;
  unsafe: boolean;
  /**
   * R2.22 Part 8 rule 7 — the reviewer may not ignore the provider's construction record. It must
   * explicitly confirm it or dispute it; a dispute must say what it disputes.
   */
  constructionAgrees: boolean;
  constructionDispute: string;
  defectCodes: string[];
  conciseExplanation: string;
};

export const PHASE_CHOICE_REVIEW_JSON_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      phase: { type: "string", enum: CHOICE_PHASES },
      branchIndex: { type: "integer" },
      choiceIndex: { type: "integer" },
      legitimateValue: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
      acceptedCost: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
      competentIntent: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
      actionable: { type: "boolean" },
      defensible: { type: "boolean" },
      dominatedBySibling: { type: "boolean" },
      badFaith: { type: "boolean" },
      vagueReassurance: { type: "boolean" },
      nonCommitmentDecoy: { type: "boolean" },
      unsafe: { type: "boolean" },
      constructionAgrees: { type: "boolean" },
      constructionDispute: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
      defectCodes: { type: "array", items: { type: "string", enum: PHASE_CHOICE_DEFECT_CODES } },
      conciseExplanation: { type: "string", maxLength: GEN_REVIEW_TEXT_MAX },
    },
    required: [
      "phase", "branchIndex", "choiceIndex", "legitimateValue", "acceptedCost", "competentIntent",
      "actionable", "defensible", "dominatedBySibling", "badFaith", "vagueReassurance",
      "nonCommitmentDecoy", "unsafe", "constructionAgrees", "constructionDispute", "defectCodes",
      "conciseExplanation",
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Coverage + consistency
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export const choiceKey = (r: { phase: string; branchIndex: number; choiceIndex: number }): string =>
  `${r.phase}:${r.branchIndex}:${r.choiceIndex}`;
export const refKey = (c: ChoiceRef): string => `${c.phase}:${c.branchIndex}:${c.index}`;

export type PhaseChoiceCollection = {
  /** Malformed-review errors — the review cannot be trusted in either direction. */
  errors: string[];
  /** Product defects the review's own detail establishes. */
  defects: string[];
  reviews: PhaseChoiceReview[];
  /** For retry feedback: exactly where each defect is. */
  perChoice: Array<{ phase: ChoicePhase; branchIndex: number; choiceIndex: number; codes: string[] }>;
  /** Construction records the reviewer explicitly disputed — captured, never silently dropped. */
  disagreements: Array<{ phase: ChoicePhase; branchIndex: number; choiceIndex: number; dispute: string }>;
};

/**
 * Parse the all-phase choice review and collect what it establishes.
 *
 * `expected` is the authority on coverage: every visible choice must be reviewed EXACTLY once. A
 * review that skipped a phase cannot accept, because it never looked at it.
 */
export function collectPhaseChoiceReviews(raw: unknown, expected: ChoiceRef[], labels: Map<string, string>): PhaseChoiceCollection {
  const errors: string[] = [];
  const defects: string[] = [];
  const perChoice: PhaseChoiceCollection["perChoice"] = [];
  const disagreements: PhaseChoiceCollection["disagreements"] = [];

  if (!Array.isArray(raw)) return { errors: ["review_phase_choices_missing"], defects, reviews: [], perChoice, disagreements };

  const wanted = new Map(expected.map((c) => [refKey(c), c]));
  const seen = new Set<string>();
  const reviews: PhaseChoiceReview[] = [];

  for (const item of raw) {
    const o = isObj(item) ? item : {};
    const phase = (CHOICE_PHASES as readonly string[]).includes(str(o.phase)) ? (o.phase as ChoicePhase) : null;
    if (!phase) {
      errors.push("review_phase_invalid");
      continue;
    }
    const branchIndex = typeof o.branchIndex === "number" ? o.branchIndex : -1;
    const choiceIndex = typeof o.choiceIndex === "number" ? o.choiceIndex : -1;
    const key = choiceKey({ phase, branchIndex, choiceIndex });
    if (!wanted.has(key)) {
      errors.push("review_phase_choice_unknown");
      continue;
    }
    if (seen.has(key)) {
      errors.push("review_phase_choice_duplicated");
      continue;
    }
    seen.add(key);

    const r: PhaseChoiceReview = {
      phase,
      branchIndex,
      choiceIndex,
      legitimateValue: str(o.legitimateValue),
      acceptedCost: str(o.acceptedCost),
      competentIntent: str(o.competentIntent),
      actionable: o.actionable === true,
      defensible: o.defensible === true,
      dominatedBySibling: o.dominatedBySibling === true,
      badFaith: o.badFaith === true,
      vagueReassurance: o.vagueReassurance === true,
      nonCommitmentDecoy: o.nonCommitmentDecoy === true,
      unsafe: o.unsafe === true,
      constructionAgrees: o.constructionAgrees === true,
      constructionDispute: str(o.constructionDispute),
      defectCodes: strs(o.defectCodes),
      conciseExplanation: str(o.conciseExplanation),
    };
    reviews.push(r);

    // --- what this choice's own detail establishes ---------------------------
    const codes = new Set<string>(r.defectCodes);
    if (r.badFaith) codes.add("bad_faith_option");
    if (r.dominatedBySibling) codes.add("dominated_choice");
    if (r.unsafe) codes.add("unsafe_option");
    if (r.vagueReassurance) codes.add("vague_reassurance");
    if (r.nonCommitmentDecoy) codes.add("non_commitment_decoy");
    if (!r.actionable) codes.add("vague_evasion");
    if (r.defensible) {
      // A defensible choice that names no value or no cost is a contradiction, not a pass.
      if (!r.legitimateValue.trim()) codes.add("no_legitimate_value");
      if (!r.acceptedCost.trim()) codes.add("dominated_choice");
    } else if (codes.size === 0) {
      codes.add("bad_faith_option"); // not defensible, but unexplained — fail closed
    }

    // Part 8 rule 5 — a competence claim over a label that is measurably bad faith is not a finding,
    // it is a broken review. The label is the ground truth the reviewer was given.
    const label = labels.get(key) ?? "";
    if (r.defensible && r.competentIntent.trim() && /\b(deflect|deflecting|stall|stalling|pacify|placate)\b/i.test(label)) {
      errors.push("review_intent_contradicts_label");
    }
    // Part 8 rule 7 — a dispute must state what it disputes.
    if (!r.constructionAgrees) {
      if (!r.constructionDispute.trim()) errors.push("review_construction_dispute_empty");
      else disagreements.push({ phase, branchIndex, choiceIndex, dispute: r.constructionDispute });
    }

    if (codes.size) {
      defects.push(...codes);
      perChoice.push({ phase, branchIndex, choiceIndex, codes: [...codes] });
    }
  }

  for (const [key] of wanted) if (!seen.has(key)) errors.push("review_phase_choice_uncovered");

  // A decoy that recurs across branches is a pattern, not an incident — it must be named as one so
  // the retry replaces EVERY occurrence rather than only the first.
  const decoyBranches = new Set(
    perChoice
      .filter((p) => p.branchIndex >= 0 && p.codes.some((c) => c === "vague_reassurance" || c === "non_commitment_decoy" || c === "false_reassurance"))
      .map((p) => p.branchIndex),
  );
  if (decoyBranches.size >= 2) defects.push("repeated_decoy_across_branches");

  return { errors: [...new Set(errors)], defects: [...new Set(defects)], reviews, perChoice, disagreements };
}
