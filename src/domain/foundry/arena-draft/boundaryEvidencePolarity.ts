/**
 * PREREQUISITE EVIDENCE POLARITY AUTHORITY (Slice 3.2I-R5B1A.1-R2.44).
 *
 * WHAT R2.43 MEASURED
 *
 * The R2.42 live review produced a complete twelve-surface matrix and ten findings, eight of them
 * false. Five came from one span:
 *
 *     "You have verified identifiers for both patients and provided the necessary treatment
 *      without compromising on safety,"
 *
 * offered — and selected — as prerequisite FAILURE evidence. It affirmatively proves the
 * prerequisite was MET. On `branch[0].resulting_world_state` the very same span was simultaneously
 * the governed-action candidate `3-a1`, the satisfaction candidate `3-s3` and the failure candidate
 * `3-f1`, so one sentence proved both that the action happened and that the prerequisite failed. The
 * four descendants inherited it through `parent_generated_state`.
 *
 * The cause is one line: `isEligibleExcerpt` applied a single test — prerequisite-stem overlap — to
 * BOTH prerequisite roles. Overlap says the span is ABOUT the prerequisite. It says nothing about
 * which way it points.
 *
 * WHAT THIS MODULE DOES
 *
 * It asks the second question: does this span assert the prerequisite was met, or that it was not?
 *
 * FRAME-RELATIVE, NOT A DOMAIN LIST. Every prerequisite term comes from the canonical semantic
 * frame, so a boundary about dual authorization before disbursement moves the test with it — proved
 * in test against a boundary sharing no vocabulary with c18. What is hard-coded is only general
 * English polarity machinery: negation, absence, deficient quantity, morphological `un-`, and the
 * auxiliary+participle completion construction.
 *
 * TOKEN BOUNDARIES, NOT SUBSTRINGS. The prerequisite stem for c18 is `verif`, which is a substring
 * of BOTH "verified" and "unverified". Every judgement here is made on tokenized text with the
 * negating prefix inspected explicitly, so the two never collapse.
 *
 * LOCALITY. Signals count only within a small window of a prerequisite term. R2.39 measured what
 * happens without that rule: "without compromising on safety" — nine tokens away from the nearest
 * prerequisite term, and about safety rather than verification — dragged the whole span negative and
 * stripped the safe branch of its only satisfaction evidence.
 *
 * Pure domain: no I/O, no provider, no clock.
 */

import { createHash } from "node:crypto";
import { clauseStems, normalizeForGrounding } from "./boundaryClauseTerms";

export const EVIDENCE_POLARITY_VERSION = "practice-boundary-evidence-polarity/1";

export const EVIDENCE_POLARITY = [
  /** Asserts the prerequisite HAS been met. Never failure evidence. */
  "satisfaction_only",
  /** Asserts it has NOT been met. Never satisfaction evidence. */
  "failure_only",
  /** Asserts both — "one was recorded, but the second remains missing". */
  "mixed",
  /** Says nothing about the prerequisite at all. */
  "unrelated",
  /** Mentions the prerequisite without pointing either way. */
  "uncertain",
] as const;
export type EvidencePolarity = (typeof EVIDENCE_POLARITY)[number];

export const POLARITY_REFUSAL_CODES = [
  "boundary_candidate_polarity_satisfaction_not_failure",
  "boundary_candidate_polarity_failure_not_satisfaction",
  "boundary_candidate_polarity_mixed_not_satisfaction",
] as const;
export type PolarityRefusalCode = (typeof POLARITY_REFUSAL_CODES)[number];

export type EvidencePolarityAssessment = {
  spanSha256: string;
  /** Frame-derived. Empty when the frame carries no prerequisite clause. */
  prerequisiteTerms: string[];
  /** The tokens that actually matched a prerequisite term, with their index. */
  prerequisiteTokenMatches: Array<{ token: string; index: number; morphologicallyNegated: boolean }>;
  affirmativeSatisfactionSignals: string[];
  failureAbsenceSignals: string[];
  polarity: EvidencePolarity;
};

// ---------------------------------------------------------------------------
// General English polarity machinery — no domain vocabulary
// ---------------------------------------------------------------------------

/** Explicit sentential negation. */
const NEGATION = new Set(["not", "no", "never", "without", "nor", "neither", "cannot", "cant", "didnt", "doesnt", "wasnt", "werent", "hasnt", "havent", "isnt", "arent"]);

/** Absence / non-completion predicates. */
const ABSENCE = new Set(["missing", "absent", "lacking", "lacks", "lacked", "pending", "incomplete", "outstanding", "unmet", "skipped", "bypassed", "omitted", "overlooked", "remains", "remain", "remained", "remaining", "left", "failed", "failing", "unable"]);

/** Quantities that assert the requirement is only partly met. */
const DEFICIENT_QUANTITY = [
  /\bonly\s+(one|a|an|the\s+first|part)\b/,
  /\bjust\s+(one|a|an)\b/,
  /\bone\s+of\s+the\s+two\b/,
  /\bfewer\s+than\b/,
  /\bless\s+than\b/,
  /\bpartial\w*\b/,
];

/**
 * Contrast connectives. A span may reverse itself AFTER stating the prerequisite met, and English
 * routinely elides the noun when it does: "One authorization was recorded, but the second remains
 * missing." The absence predicate is four tokens from the nearest prerequisite term, so the locality
 * window cannot see it — but the contrast connective says a reversal is being made.
 *
 * This is why the rule is scoped to a CONNECTIVE rather than to distance: widening the window
 * instead would readmit "without compromising on safety" nine tokens away, which is precisely the
 * over-drop R2.39 measured.
 */
const CONTRAST = new Set(["but", "however", "yet", "although", "though", "whereas", "still"]);

/** Auxiliaries that, immediately before a prerequisite participle, assert completion. */
const COMPLETION_AUXILIARY = new Set(["have", "has", "had", "was", "were", "is", "are", "been", "having"]);

/** Prefixes that negate the word they attach to. `un-` on `unverified` is the measured case. */
const NEGATING_PREFIX = ["un", "non", "im", "ir"];

/** How far from a prerequisite term a signal must be to count. R2.39 measured the cost of no window. */
const SIGNAL_WINDOW = 3;
/** How far after an auxiliary a prerequisite participle may sit for the pair to read as completion. */
const AUXILIARY_REACH = 2;

const tokenize = (s: string): string[] => normalizeForGrounding(s).split(" ").filter(Boolean);
const digest = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

/**
 * Does this single TOKEN carry a prerequisite term, and is it morphologically negated?
 *
 * `unverified` contains the stem `verif`, so a substring test would call it a prerequisite mention
 * pointing the same way as `verified`. The prefix is inspected explicitly instead: a token whose
 * stem match begins after a negating prefix is a NEGATED mention of the prerequisite.
 */
function matchToken(token: string, terms: string[]): { matched: boolean; negated: boolean } {
  for (const term of terms) {
    const at = token.indexOf(term);
    if (at < 0) continue;
    if (at === 0) return { matched: true, negated: false };
    const prefix = token.slice(0, at);
    if (NEGATING_PREFIX.includes(prefix)) return { matched: true, negated: true };
    // A stem sitting mid-token behind something other than a known negator (e.g. "reverified") is a
    // mention, not a negation.
    return { matched: true, negated: false };
  }
  return { matched: false, negated: false };
}

/**
 * Classify one span against one boundary's prerequisite clause.
 *
 * The span is judged ONLY where it talks about the prerequisite: signals are gathered in a window
 * around each matching token, never across the whole sentence.
 */
export function assessEvidencePolarity(prerequisiteClause: string, span: string): EvidencePolarityAssessment {
  const prerequisiteTerms = clauseStems(prerequisiteClause);
  const tokens = tokenize(span);
  const normalized = normalizeForGrounding(span);
  const base = { spanSha256: digest(span), prerequisiteTerms, prerequisiteTokenMatches: [] as EvidencePolarityAssessment["prerequisiteTokenMatches"], affirmativeSatisfactionSignals: [] as string[], failureAbsenceSignals: [] as string[] };

  if (prerequisiteTerms.length === 0 || tokens.length === 0) return { ...base, polarity: "unrelated" };

  const matches = tokens
    .map((t, index) => ({ token: t, index, ...matchToken(t, prerequisiteTerms) }))
    .filter((m) => m.matched)
    .map((m) => ({ token: m.token, index: m.index, morphologicallyNegated: m.negated }));
  if (matches.length === 0) return { ...base, polarity: "unrelated" };

  const affirmative: string[] = [];
  const negative: string[] = [];

  for (const m of matches) {
    // (1) morphological negation of the prerequisite word itself — "unverified".
    if (m.morphologicallyNegated) negative.push(`morphological:${m.token}`);

    const from = Math.max(0, m.index - SIGNAL_WINDOW);
    const to = Math.min(tokens.length, m.index + SIGNAL_WINDOW + 1);
    const window = tokens.slice(from, to);

    // (2) explicit negation or an absence predicate NEAR the prerequisite mention.
    for (const w of window) {
      if (NEGATION.has(w)) negative.push(`negation:${w}`);
      if (ABSENCE.has(w)) negative.push(`absence:${w}`);
    }

    // (3) deficient quantity scoping the prerequisite mention.
    const windowText = window.join(" ");
    for (const q of DEFICIENT_QUANTITY) if (q.test(windowText)) negative.push(`quantity:${q.source}`);

    // (4) completion construction: an auxiliary reaching this prerequisite token with NO negation
    //     between them. "have verified" asserts completion; "was not recorded" does not.
    for (let i = Math.max(0, m.index - AUXILIARY_REACH); i < m.index; i++) {
      if (!COMPLETION_AUXILIARY.has(tokens[i]!)) continue;
      const between = tokens.slice(i + 1, m.index);
      if (between.some((w) => NEGATION.has(w) || ABSENCE.has(w))) continue;
      affirmative.push(`completion:${tokens[i]} ${m.token}`);
    }
  }

  // (5) CONTRAST REVERSAL. A connective followed later by an absence or negation marker asserts the
  //     prerequisite is not (fully) met, even when the noun is elided after the connective.
  const contrastAt = tokens.findIndex((t) => CONTRAST.has(t));
  if (contrastAt >= 0) {
    for (const w of tokens.slice(contrastAt + 1)) {
      if (ABSENCE.has(w) || NEGATION.has(w)) negative.push(`contrast:${tokens[contrastAt]} … ${w}`);
    }
  }

  const assessment = { ...base, prerequisiteTokenMatches: matches, affirmativeSatisfactionSignals: [...new Set(affirmative)], failureAbsenceSignals: [...new Set(negative)] };
  void normalized;

  if (affirmative.length > 0 && negative.length > 0) return { ...assessment, polarity: "mixed" };
  if (affirmative.length > 0) return { ...assessment, polarity: "satisfaction_only" };
  if (negative.length > 0) return { ...assessment, polarity: "failure_only" };
  // Mentions the prerequisite, points neither way. Certainty is NOT forced.
  return { ...assessment, polarity: "uncertain" };
}

/**
 * May this span occupy this prerequisite role?
 *
 * `mixed` keeps FAILURE eligibility and loses SATISFACTION eligibility — the safe direction. A span
 * saying "one was recorded, but the second remains missing" is real evidence a prerequisite failed;
 * it is not clean proof one was met.
 *
 * `uncertain` keeps today's behaviour in both pools and is counted. R2.39 measured that forcing
 * certainty here strips a safe branch of its only satisfaction evidence, so this slice observes it.
 */
export function polarityRefusal(
  role: "prerequisite_satisfaction" | "prerequisite_failure",
  polarity: EvidencePolarity,
): PolarityRefusalCode | null {
  if (role === "prerequisite_failure" && polarity === "satisfaction_only") return "boundary_candidate_polarity_satisfaction_not_failure";
  if (role === "prerequisite_satisfaction" && polarity === "failure_only") return "boundary_candidate_polarity_failure_not_satisfaction";
  if (role === "prerequisite_satisfaction" && polarity === "mixed") return "boundary_candidate_polarity_mixed_not_satisfaction";
  return null;
}

export type PolarityDecisionLog = EvidencePolarityAssessment & {
  surfaceRef: string;
  role: "prerequisite_satisfaction" | "prerequisite_failure";
  span: string;
  refusalCode: PolarityRefusalCode | null;
};

export type PolarityMetrics = {
  prerequisiteSatisfactionOnlyCount: number;
  prerequisiteFailureOnlyCount: number;
  prerequisiteMixedCount: number;
  prerequisitePolarityUncertainCount: number;
  prerequisiteSatisfactionRefusedFromFailureCount: number;
  prerequisiteFailureRefusedFromSatisfactionCount: number;
  /** Spans still legitimately reachable in both pools after the authority — the residue. */
  prerequisiteSameSpanCrossPoolObservedCount: number;
};

export function summarizePolarity(decisions: PolarityDecisionLog[], sameSpanCrossPool: number): PolarityMetrics {
  const byPolarity = (p: EvidencePolarity) => decisions.filter((d) => d.polarity === p).length;
  return {
    prerequisiteSatisfactionOnlyCount: byPolarity("satisfaction_only"),
    prerequisiteFailureOnlyCount: byPolarity("failure_only"),
    prerequisiteMixedCount: byPolarity("mixed"),
    prerequisitePolarityUncertainCount: byPolarity("uncertain"),
    prerequisiteSatisfactionRefusedFromFailureCount: decisions.filter((d) => d.refusalCode === "boundary_candidate_polarity_satisfaction_not_failure").length,
    prerequisiteFailureRefusedFromSatisfactionCount: decisions.filter((d) => d.refusalCode === "boundary_candidate_polarity_failure_not_satisfaction").length,
    prerequisiteSameSpanCrossPoolObservedCount: sameSpanCrossPool,
  };
}

/** The classifier contract digest — moves when the decision procedure or its machinery moves. */
export const evidencePolarityContractSha256 = (): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: EVIDENCE_POLARITY_VERSION,
        polarities: EVIDENCE_POLARITY,
        refusalCodes: POLARITY_REFUSAL_CODES,
        termsFrom: "semanticFrame.prerequisiteClause",
        domainKeywordList: false,
        tokenBoundaryAware: true,
        negatingPrefixes: NEGATING_PREFIX,
        signalWindow: SIGNAL_WINDOW,
        auxiliaryReach: AUXILIARY_REACH,
        negation: [...NEGATION].sort(),
        absence: [...ABSENCE].sort(),
        deficientQuantity: DEFICIENT_QUANTITY.map(String),
        completionAuxiliary: [...COMPLETION_AUXILIARY].sort(),
        contrastConnectives: [...CONTRAST].sort(),
        mixedKeepsFailureLosesSatisfaction: true,
        uncertainObservedNotEnforced: true,
      }),
    )
    .digest("hex");
