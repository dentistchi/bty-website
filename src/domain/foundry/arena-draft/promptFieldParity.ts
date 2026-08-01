/**
 * PROMPT / SCHEMA FIELD PARITY (Slice 3.2I-R5B1A.1-R2.38 Part 10).
 *
 * WHAT R2.37 MEASURED
 *
 * The R2.36 live prompt instructed the reviewer to "quote what the surface DOES in
 * `governedActionEvidence`" and to "leave `prerequisiteFailureEvidence` … empty". Neither field
 * existed in the R2.36 schema — both had been replaced by `{segmentRef, excerpt}` objects, and the
 * parity table's prompt renderer was never updated. Two occurrences each, in the block that defines
 * every valid answer shape, shipped live.
 *
 * Nothing caught it. `tsc` cannot see inside a string, and every test asserted behaviour rather than
 * vocabulary. So the check is this module: extract every field-like token the prompt names and prove
 * each one is either a real schema field or an explicitly declared explanatory word.
 *
 * Deliberately blunt. A false positive here costs one line in the allow-list; a false negative costs
 * a live provider call and a discarded response.
 *
 * Pure domain: no I/O.
 */

/**
 * Tokens that look like a contract field: lowerCamelCase with at least one internal capital, so
 * ordinary prose ("prerequisite", "surface") is ignored and `governedActionEvidence` is not.
 */
export function extractFieldLikeTokens(prompt: string): string[] {
  const found = new Set<string>();
  for (const m of prompt.matchAll(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g)) found.add(m[0]);
  return [...found].sort();
}

export type FieldParityResult = {
  ok: boolean;
  /** Named in the prompt, present in neither the schema nor the allowed vocabulary. */
  unknownTokens: string[];
  /** Allow-list entries nothing mentions any more — dead vocabulary worth deleting. */
  unusedVocabulary: string[];
  checkedTokenCount: number;
};

/**
 * Prove the prompt's vocabulary against the ACTIVE schema.
 *
 * `schemaFields` must come from the live JSON Schema object, not from a hand-written list — a
 * hand-written list is exactly the thing that drifted.
 */
export function checkPromptFieldParity(
  prompt: string,
  schemaFields: readonly string[],
  allowedVocabulary: readonly string[],
  /** Enum VALUES the prompt legitimately names (`not_applicable`, `own_surface`, …). */
  enumValues: readonly string[] = [],
): FieldParityResult {
  const known = new Set<string>([...schemaFields, ...allowedVocabulary, ...enumValues]);
  const tokens = extractFieldLikeTokens(prompt);
  const unknownTokens = tokens.filter((t) => !known.has(t));
  const mentioned = new Set(tokens);
  const unusedVocabulary = allowedVocabulary.filter((v) => !mentioned.has(v));
  return { ok: unknownTokens.length === 0, unknownTokens, unusedVocabulary, checkedTokenCount: tokens.length };
}

/**
 * Markers that make a sentence PROHIBITIVE. A prompt is allowed — and it is useful — to say "there
 * is no compliance field"; what it must never do is instruct the model to fill one.
 */
const PROHIBITION_MARKERS = /\b(no|not|never|without|do not|don't|there is no|there are no)\b/i;

/** One mention of a removed field, with the sentence it appeared in. */
export type RemovedFieldMention = { field: string; sentence: string; prohibitive: boolean };

/**
 * Find every mention of a field a previous contract removed.
 *
 * Aimed squarely at the measured R2.36 defect: the prompt told the reviewer to "quote what the
 * surface DOES in `governedActionEvidence`" after that field had been deleted. Such an INSTRUCTIVE
 * mention is a defect. A PROHIBITIVE mention — "there is no applicability field" — is the opposite:
 * it is the prompt actively steering away from the removed field, and suppressing it would make the
 * contract less clear, not safer.
 */
export function findRemovedFieldMentions(prompt: string, removedFields: readonly string[]): RemovedFieldMention[] {
  const sentences = prompt.split(/(?<=[.!?])\s+|\n/);
  const out: RemovedFieldMention[] = [];
  for (const sentence of sentences) {
    for (const f of removedFields) {
      if (!new RegExp(`\\b${f}\\b`).test(sentence)) continue;
      out.push({ field: f, sentence: sentence.trim(), prohibitive: PROHIBITION_MARKERS.test(sentence) });
    }
  }
  return out;
}

/** The gate: a removed field may only ever appear in a sentence that forbids it. */
export const instructiveRemovedFieldMentions = (prompt: string, removedFields: readonly string[]): RemovedFieldMention[] =>
  findRemovedFieldMentions(prompt, removedFields).filter((m) => !m.prohibitive);
