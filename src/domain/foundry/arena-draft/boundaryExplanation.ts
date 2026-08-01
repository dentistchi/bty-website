/**
 * SERVER-DERIVED BOUNDARY EXPLANATION AUTHORITY (Slice 3.2I-R5B1A.1-R2.32).
 *
 * WHY THIS EXISTS
 *
 * R2.31 measured that model-authored `reason` prose was redundant everywhere it was required:
 *
 *     not_applicable   governedActionEvidence "Prepare a detailed report for the administrator"
 *                      reason                 "This surface does something else: it prepares a report."
 *
 * The reason paraphrased the excerpt. For violations, `violationMechanism` +
 * `governedActionEvidence` + `prerequisiteFailureEvidence` already encode the whole finding. So the
 * pipeline discarded two complete live responses over a field that carried nothing a verdict used.
 *
 * WHAT THIS IS
 *
 * A RENDERER, not a judge. It converts findings the validator has already established into product
 * copy. It runs AFTER the verdict is derived and its output is never read back into any semantic
 * decision — see `deriveBoundaryVerdict`, which does not import this module.
 *
 * HARD RULES
 *
 *  - It may not introduce a conclusion that is not already in the structured fields.
 *  - It is deterministic: identical findings render byte-identically.
 *  - It never inspects free text for meaning; it only places grounded excerpts into a frame.
 *  - `model_required` states have NO server explanation — the model's words are the explanation.
 *
 * Pure domain: no I/O, no clock, no randomness.
 */

import { createHash } from "node:crypto";
import { classifyAssessmentState, type AssessmentStateId } from "./boundaryReasonParity";

export const EXPLANATION_AUTHORITY_VERSION = "practice-boundary-explanation/1";

/** The product locales the narrow review renders for. Korean is a first-class Practice locale. */
export const EXPLANATION_LOCALES = ["en", "ko"] as const;
export type ExplanationLocale = (typeof EXPLANATION_LOCALES)[number];

/** Exactly the structured inputs a rendering may read. Nothing else is in scope. */
export type ExplainableAssessment = {
  boundaryId: string;
  boundaryStatement: string;
  surfaceRef: string;
  applicability: string;
  compliance: string;
  violationMechanism: string;
  governedActionEvidence: string;
  prerequisiteFailureEvidence: string;
  /** Present only for `model_required` states; carried through verbatim, never rewritten. */
  modelReason: string;
};

export type ServerExplanation = {
  surfaceRef: string;
  boundaryId: string;
  stateId: AssessmentStateId | "invalid_state";
  /** `server` when this module composed it, `model` when the state requires the reviewer's words. */
  authority: "server" | "model";
  en: string;
  ko: string;
};

/** Mechanism → product phrase. One entry per registered mechanism; no fallback prose is invented. */
const MECHANISM_COPY: Record<string, { en: string; ko: string }> = {
  governed_action_without_prerequisite: {
    en: "commits to the governed action while the rule is unmet",
    ko: "규칙이 충족되지 않은 상태에서 해당 행동을 실행합니다",
  },
  resulting_state_missing_prerequisite: {
    en: "asserts a state in which the governed action already happened without the rule",
    ko: "규칙 없이 해당 행동이 이미 일어난 상태를 전제합니다",
  },
  boundary_reopened_after_prior_compliance: {
    en: "undoes a rule that was already satisfied",
    ko: "이미 충족된 규칙을 다시 무너뜨립니다",
  },
  explicit_boundary_contradiction: {
    en: "states something the rule forbids outright",
    ko: "규칙이 명시적으로 금지한 것을 진술합니다",
  },
};

/** Collapse whitespace so an excerpt renders on one line. Never changes meaning. */
const tidy = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Render one assessment's explanation.
 *
 * For a `model_required` state the model's own reason IS the explanation and is returned verbatim
 * under `authority: "model"`. For every other state the server composes it from grounded fields.
 */
export function explainAssessment(a: ExplainableAssessment): ServerExplanation {
  const state = classifyAssessmentState(a);
  const base = { surfaceRef: a.surfaceRef, boundaryId: a.boundaryId };
  if (!state) {
    return { ...base, stateId: "invalid_state", authority: "server", en: "", ko: "" };
  }
  if (state.reasonAuthority === "model_required") {
    const reason = tidy(a.modelReason);
    return { ...base, stateId: state.id, authority: "model", en: reason, ko: reason };
  }

  const governed = tidy(a.governedActionEvidence);
  const failure = tidy(a.prerequisiteFailureEvidence);
  const rule = tidy(a.boundaryStatement);

  switch (state.id) {
    case "not_applicable":
      return {
        ...base,
        stateId: state.id,
        authority: "server",
        en: `${a.surfaceRef} does not perform the action governed by ${a.boundaryId}. It does this instead: “${governed}”.`,
        ko: `${a.surfaceRef}은(는) ${a.boundaryId}이(가) 규율하는 행동을 수행하지 않습니다. 대신 “${governed}”을(를) 합니다.`,
      };
    case "complies":
      return {
        ...base,
        stateId: state.id,
        authority: "server",
        en: `${a.surfaceRef} performs the action governed by ${a.boundaryId} (“${rule}”) with the rule kept: “${governed}”.`,
        ko: `${a.surfaceRef}은(는) ${a.boundaryId}(“${rule}”)의 규칙을 지킨 상태로 해당 행동을 수행합니다: “${governed}”.`,
      };
    case "violates_registered_mechanism": {
      const copy = MECHANISM_COPY[a.violationMechanism];
      // A mechanism with no registered copy cannot be rendered; the validator refuses it upstream,
      // so an empty rendering here is a signal, never a silent paraphrase.
      if (!copy) return { ...base, stateId: state.id, authority: "server", en: "", ko: "" };
      return {
        ...base,
        stateId: state.id,
        authority: "server",
        en: `${a.surfaceRef} ${copy.en} — ${a.boundaryId}: “${rule}”. It does this: “${governed}”, while the text states: “${failure}”.`,
        ko: `${a.surfaceRef}은(는) ${copy.ko} — ${a.boundaryId}: “${rule}”. 해당 부분은 “${governed}”이며, 본문은 “${failure}”이라고 진술합니다.`,
      };
    }
    default:
      return { ...base, stateId: state.id, authority: "server", en: "", ko: "" };
  }
}

export const explainAll = (rows: ExplainableAssessment[]): ServerExplanation[] => rows.map(explainAssessment);

/**
 * Digest over the rendered set plus the authority version. Included in evidence so an auditor can
 * tell that a stored explanation was produced by this exact renderer.
 */
export function explanationSha256(explanations: ServerExplanation[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ version: EXPLANATION_AUTHORITY_VERSION, explanations }))
    .digest("hex");
}

/** Digest over the renderer contract itself — moves when copy or mechanism mapping moves. */
export function explanationAuthoritySha256(): string {
  return createHash("sha256")
    .update(JSON.stringify({ version: EXPLANATION_AUTHORITY_VERSION, locales: EXPLANATION_LOCALES, mechanismCopy: MECHANISM_COPY }))
    .digest("hex");
}
