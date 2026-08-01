/**
 * PREREQUISITE-TERM ANCHORING (Slice 3.2I-R5B1A.1-R2.36, extracted in R2.38).
 *
 * Content stems of a boundary clause, used to decide whether a span genuinely concerns the
 * prerequisite the boundary names. Anchored to the boundary's OWN decomposed clause — never a
 * hand-written domain vocabulary, so a boundary about signatures moves the test with it.
 *
 * R2.36 kept this inside the output contract. R2.38 needs it one layer earlier, at candidate
 * extraction, so an ineligible span is never offered rather than being offered and then refused.
 * It lives here so the candidate authority and the output contract share one implementation
 * instead of drifting into two.
 *
 * Pure domain: no I/O.
 */

export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Modal verbs and articles. Nothing domain-specific. */
const CLAUSE_STOP_WORDS = new Set([
  "a", "an", "the", "must", "be", "is", "are", "was", "were", "shall", "should", "will", "to", "of",
  "for", "and", "or", "in", "on", "at", "by", "with", "before", "after", "prior", "that", "this",
  "it", "its", "has", "have", "had", "not", "no", "any", "all", "each", "every", "required",
]);

/**
 * Light suffix stripping only — enough that "verified", "verification" and "unverified" reduce to a
 * shared prefix, so a NEGATED form of the prerequisite still matches.
 */
export function clauseStems(clause: string): string[] {
  return normalizeForGrounding(clause)
    .split(" ")
    .filter((w) => w.length >= 4 && !CLAUSE_STOP_WORDS.has(w))
    .map((w) => w.replace(/(ications?|ication|ations?|ation|ing|ied|ies|ed|es|s)$/u, ""))
    .filter((w) => w.length >= 4);
}
