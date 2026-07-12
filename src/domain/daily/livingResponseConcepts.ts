/**
 * livingResponseConcepts (domain) — the safe, human semantic anchors a Living Response may be built
 * from. Pure. These are NOT machine codes and are never shown as codes; they are behavioral concept
 * words (ownership, repair, naming, …) derived from admissible evidence, used to (a) instruct the
 * prompt, (b) require a real evidence anchor in the validator, and (c) select evidence-specific
 * deterministic fallback. The user-facing line expresses a concept naturally — never the token.
 */

export const LIVING_RESPONSE_CONCEPTS = [
  "ownership",
  "accountability",
  "repair",
  "directness",
  "communication",
  "truth",
  "naming",
  "follow_through",
  "change",
  "consistency",
  "return",
  "regard",
] as const;
export type LivingResponseConcept = (typeof LIVING_RESPONSE_CONCEPTS)[number];

/** pattern_family → the concept it canonically carries (for OTHERS verified relational evidence). */
export const CONCEPT_FROM_PATTERN_FAMILY: Readonly<Record<string, LivingResponseConcept>> = {
  ownership_escape: "ownership",
  repair_avoidance: "repair",
  explanation_substitution: "accountability",
  delegation_deflection: "directness",
  future_deferral: "follow_through",
  truth_naming: "truth",
  integrity_compromise: "consistency",
  authority_protection: "directness",
  reputation_protection: "regard",
};

/** evidence class → concepts, for classes whose concept is intrinsic (not family-derived). */
export const CONCEPTS_FROM_EVIDENCE_CLASS: Readonly<Record<string, LivingResponseConcept[]>> = {
  self_return_continuity: ["return", "consistency"],
  self_keep_continuity: ["naming", "return"],
  others_reexposure_change: ["change", "follow_through"],
  // others_verified_relational_action → derived from pattern_family at assembly time.
};

/** Natural-language anchor patterns (EN + KO) — the validator requires ≥1 concept to surface here. */
export const CONCEPT_ANCHOR_PATTERNS: Readonly<Record<LivingResponseConcept, RegExp>> = {
  ownership: /\b(own(s|ing|ership)?|responsib\w*|carr(y|ies|ying))\b|책임|맡|떠안|짊어/i,
  accountability: /\b(account\w*|responsib\w*|answer for|own(s|ing)?)\b|책임|답/i,
  repair: /\b(repair\w*|mend\w*|amend\w*|address(ed|es|ing)?|avoided|make (it )?right)\b|회복|고치|바로잡|마주|미뤄/i,
  directness: /\b(direct(ly|ness)?|clear(ly)?|straight|plainly|say(s|ing)?|speak\w*|tell\w*)\b|분명|솔직|직접|말/i,
  communication: /\b(conversation|talk(s|ing)?|speak\w*|word(s)?|say(s|ing)?|tell\w*|voice)\b|대화|말|이야기|목소리/i,
  truth: /\b(truth\w*|honest\w*|true|real(ly)?)\b|진실|정직|사실|참/i,
  naming: /\b(nam(e|es|ing)|specific(ally)?|clear(ly)?|put into words)\b|이름|말로|분명히/i,
  follow_through: /\b(follow[- ]?through|finish\w*|complete\w*|keep(s|ing)?|sustain\w*|through|carry)\b|끝까지|마무리|이어|지켜|계속/i,
  change: /\b(change\w*|shift\w*|different|becom(e|es|ing)|move(s|d)?)\b|변화|달라|바뀌|바꾸/i,
  consistency: /\b(consisten\w*|steady|steadi\w*|again|reliab\w*|repeat\w*|keep(s|ing)?)\b|꾸준|한결|반복|계속/i,
  return: /\b(return(s|ing)?|back|come back|enter(s|ing)?|begin\w*|start\w*|show(s|ing)? up)\b|돌아|다시|들어|시작/i,
  regard: /\b(regard\w*|how (you are|you're) seen|others['’]? (eyes|view)|reputation)\b|시선|평가|눈|평판/i,
};

/** Build one combined anchor test from a packet's concepts (empty → matches nothing). */
export function anchorMatcher(concepts: string[]): (text: string) => boolean {
  const pats = concepts.map((c) => CONCEPT_ANCHOR_PATTERNS[c as LivingResponseConcept]).filter(Boolean);
  return (text: string) => pats.some((p) => p.test(text));
}
