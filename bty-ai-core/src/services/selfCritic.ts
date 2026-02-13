/**
 * SelfCritic
 * Validates draft responses against BTY output contract.
 * pass=false if any high severity issue exists.
 */

import { countSentences } from "./guardrails";
import {
  getBannedPhrases,
  getFalsePersonaPatterns,
  getFalsePersonaReplacement,
  getDependencyRiskPatterns,
  getThresholds,
} from "../config/patchConfig";

export type CriticSeverity = "low" | "medium" | "high";

export type CriticResult = {
  pass: boolean;
  issues: string[];
  severity: CriticSeverity;
};

export type CriticizeOptions = {
  maxSentences?: number;
};

/** @deprecated Use getFalsePersonaPatterns() from patchConfig */
export const FALSE_PERSONA_PATTERNS = getFalsePersonaPatterns();

/** @deprecated Use getFalsePersonaReplacement() from patchConfig */
export const FALSE_PERSONA_REPLACEMENT = getFalsePersonaReplacement();

function extractCoreWords(text: string): string[] {
  const t = (text || "").trim().toLowerCase();
  if (!t) return [];
  const tokens = t
    .split(/[\s,.;:!?()[\]"'`]+/)
    .filter((w) => w.length >= 2)
    .filter((w) => !/^(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|dare|ought|used)$/i.test(w))
    .filter((w) => !/^(그|이|저|것|수|있|되|하|않|등|등등)$/.test(w));
  return [...new Set(tokens)];
}

function checkContextDrift(userText: string, draft: string): boolean {
  const userWords = extractCoreWords(userText);
  const draftLower = (draft || "").trim().toLowerCase();

  if (userWords.length < 2 || !draftLower) return false; // too short to judge
  const overlap = userWords.filter((w) => draftLower.includes(w)).length;
  const overlapRatio = overlap / userWords.length;
  const threshold = getThresholds().context_drift_overlap;
  return overlapRatio < threshold; // drift if less than threshold core words reflected
}

function checkQuestionOverload(draft: string): boolean {
  const count = (draft.match(/[?？]/g) || []).length;
  return count > 1;
}

function checkVerbosity(draft: string, maxSentences: number): boolean {
  const n = countSentences(draft);
  return n > maxSentences;
}

function checkCoachTone(draft: string): string[] {
  const found: string[] = [];
  for (const phrase of getBannedPhrases()) {
    if (draft.includes(phrase)) found.push(phrase);
  }
  return found;
}

function checkFalsePersona(draft: string): string[] {
  const found: string[] = [];
  for (const p of getFalsePersonaPatterns()) {
    const m = draft.match(p);
    if (m) found.push(m[0].trim());
  }
  return found;
}

function checkDependencyRisk(draft: string): string[] {
  const found: string[] = [];
  for (const p of getDependencyRiskPatterns()) {
    const m = draft.match(p);
    if (m) found.push(m[0].trim());
  }
  return found;
}

/**
 * Criticizes a draft response against user input and BTY contract.
 * pass=false if any high severity issue exists.
 */
export function criticizeResponse(
  userText: string,
  draft: string,
  options: CriticizeOptions = {}
): CriticResult {
  const { maxSentences = getThresholds().max_sentences } = options;
  const issues: string[] = [];
  let overallSeverity: CriticSeverity = "low";

  const upgradeSeverity = (s: CriticSeverity) => {
    if (s === "high") overallSeverity = "high";
    else if (s === "medium" && overallSeverity !== "high") overallSeverity = "medium";
  };

  // context_drift: draft does not reflect userText key point
  if (checkContextDrift(userText, draft)) {
    issues.push("context_drift: draft does not reflect user key point");
    upgradeSeverity("high");
  }

  // question_overload: more than 1 question mark
  if (checkQuestionOverload(draft)) {
    issues.push("question_overload: more than 1 question in response");
    upgradeSeverity("high");
  }

  // verbosity: more than pacingProfile.maxSentences
  if (checkVerbosity(draft, maxSentences)) {
    issues.push(
      `verbosity: draft has more than ${maxSentences} sentences`
    );
    upgradeSeverity("medium");
  }

  // coach_tone: contains banned phrases
  const coachPhrases = checkCoachTone(draft);
  if (coachPhrases.length > 0) {
    issues.push(`coach_tone: contains banned phrases (${coachPhrases.join(", ")})`);
    upgradeSeverity("high");
  }

  // false_persona: AI implying personal experience
  const personaPhrases = checkFalsePersona(draft);
  if (personaPhrases.length > 0) {
    issues.push(
      `false_persona: AI implying personal experience (${personaPhrases.join(", ")})`
    );
    upgradeSeverity("high");
  }

  // dependency_risk: overly bonding phrases
  const bondingPhrases = checkDependencyRisk(draft);
  if (bondingPhrases.length > 0) {
    issues.push(
      `dependency_risk: overly bonding phrases (${bondingPhrases.join(", ")})`
    );
    upgradeSeverity("medium");
  }

  return {
    pass: overallSeverity === "low" || overallSeverity === "medium",
    issues,
    severity: overallSeverity,
  };
}
