import { overlapRatio } from "./program-authorship";

/**
 * DOES THIS QUESTION ASK THE LEARNER FOR ANYTHING? — advisory only (Slice R4-R5C12A).
 *
 * The provenance recognisers live in `btyQuestionDefaults.ts`; see the note there for why the
 * two halves are separate files. They are re-exported here so a caller needing both reads one
 * import.
 */
export * from "./btyQuestionDefaults";

const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// What does the question ask for?
// ---------------------------------------------------------------------------

/**
 * 0.50, calibrated on the live corpus rather than chosen. `overlapRatio` divides by the SMALLER
 * token set, so 1.00 means one text carries every significant word of the other. Across 37 live
 * completion questions the distribution is 8 at 1.00, 22 at or above 0.50 and 26 at or above
 * 0.33; 0.50 separates "the standard is in the question" from ordinary shared subject matter,
 * and the two questions BTY now suggests score 0 against every standard in the corpus.
 */
export const QUESTION_OVERLAP_HIGH = 0.5;

/** Stems that ask the learner to give back what the training just told them. */
const RECALL_STEM: readonly RegExp[] = [
  /\bwhat\s+(?:is|was|are|were)\s+the\s+(?:most\s+important\s+)?standard\b/i,
  /\bmost\s+important\s+standard\b/i,
  /\bin\s+your\s+own\s+words\s*,?\s*(?:what|describe|explain|summar)/i,
  /\bdescribe\s+the\s+standard\b/i,
  /\bwhat\s+should\s+you\s+do\b/i,
  /\bdescribe\s+how\s+you\s+will\b/i,
  /\bhow\s+will\s+you\s+(?:use|follow|apply|ensure)\b/i,
  /\bhow\s+you\s+will\s+(?:use|follow|apply|ensure)\b/i,
  /\bsummar(?:y|ise|ize)\b/i,
  /\bwhat\s+(?:did|have)\s+you\s+learn/i,
  // KO — the same four jobs, since both defaults ship in both languages.
  /가장\s*중요한\s*(?:행동\s*)?기준/,
  /자신의\s*말로/,
  /무엇을\s*해야\s*하나요/,
  /어떻게\s*(?:사용|적용|준수)하(?:겠|시겠)/,
];

/** Stems that ask about the learner's world as it is today. */
const CURRENT_PRACTICE_STEM: readonly RegExp[] = [
  /\bwhat\s+usually\s+happens\b/i,
  /\bwhat\s+happens\s+(?:now|today)\b/i,
  /\bhow\s+is\s+(?:this|it)\s+handled\s+(?:today|now)\b/i,
  /\bhow\s+do\s+you\s+handle\s+(?:this|it)\s+(?:today|now)\b/i,
  /\bwhat\s+(?:gets|is\s+getting)\s+in\s+the\s+way\b/i,
  /\bwhat\s+makes\s+(?:this|it)\s+(?:hard|difficult)\b/i,
  /\bright\s+now\b/i,
  /\btoday\b/i,
  /보통\s*어떻게/,
  /지금은/,
  /평소/,
  /무엇이\s*(?:어려|힘드)/,
];

/** Stems that ask the learner to decide or plan something of their own. */
const APPLICATION_STEM: readonly RegExp[] = [
  /\bwhat\s+will\s+you\s+(?:change|try|do)\b/i,
  /\bdifferently\b/i,
  /\bnext\s+time\b/i,
  /\bone\s+(?:thing|concrete\s+thing)\s+you\s+will\b/i,
  /\bwhat\s+is\s+one\s+thing\b/i,
  /다르게/,
  /다음에\s*이런/,
  /한\s*가지/,
];

const anyOf = (patterns: readonly RegExp[], s: string): boolean => patterns.some((re) => re.test(s));

/** The four semantic facts about one learner question. Pure; no policy, no wording. */
export type LearnerQuestionShape = {
  /** The question carries the standard's own vocabulary at or above the calibrated threshold. */
  highOverlap: boolean;
  /** The question asks for the training's content back. */
  recallLike: boolean;
  /** The question asks what the learner's situation is like today. */
  currentPracticeLike: boolean;
  /** The question asks the learner to decide or plan something. */
  applicationLike: boolean;
};

export function classifyLearnerQuestion(question: unknown, standard: unknown): LearnerQuestionShape {
  const q = trimmed(question);
  const std = trimmed(standard);
  if (q.length === 0) {
    return { highOverlap: false, recallLike: false, currentPracticeLike: false, applicationLike: false };
  }
  return {
    highOverlap: std.length > 0 && overlapRatio(q, std) >= QUESTION_OVERLAP_HIGH,
    recallLike: anyOf(RECALL_STEM, q),
    currentPracticeLike: anyOf(CURRENT_PRACTICE_STEM, q),
    applicationLike: anyOf(APPLICATION_STEM, q),
  };
}

/**
 * Can this question be answered by repeating the training above?
 *
 * EITHER signal is enough to raise it, because they catch disjoint failures. BOTH positive signals
 * suppress it, because a question that asks for the learner's own situation or their own next
 * decision has already given them something only they can supply — sharing vocabulary with the
 * standard is then subject matter, not leakage. That asymmetry is what lets BTY's own two
 * suggestions pass a check BTY wrote, which is the minimum honesty bar for shipping it.
 */
export function isCopyLikeQuestion(shape: LearnerQuestionShape): boolean {
  if (shape.currentPracticeLike || shape.applicationLike) return false;
  return shape.highOverlap || shape.recallLike;
}

/** One convenience read for a caller holding raw strings. */
export function questionIsCopyLike(question: unknown, standard: unknown): boolean {
  return isCopyLikeQuestion(classifyLearnerQuestion(question, standard));
}

/** The two Builder fields that become a question the learner has to answer. */
export type LearnerQuestionField = "completionPrompt" | "sharedQuestion";

/**
 * Which of this draft's learner questions can be answered by repeating the training.
 *
 * Reads the STORED values only. A field the Host has not touched holds nothing — the suggestion
 * is displayed, never patched (Slice 3.2L-R11.4B) — so there is no question to advise about yet,
 * and BTY does not warn about a sentence that is not going to be published.
 *
 * Both localized defaults BTY now suggests are classified healthy by this same function, which is
 * asserted by test rather than assumed: a product that warns against its own prefill is telling
 * the Host their first screen is broken.
 */
export function copyLikeLearnerQuestions(
  a: { observableBehavior?: string; completionPrompt?: string; sharedQuestion?: string } | undefined,
): LearnerQuestionField[] {
  const standard = a?.observableBehavior ?? "";
  const out: LearnerQuestionField[] = [];
  if (questionIsCopyLike(a?.completionPrompt, standard)) out.push("completionPrompt");
  if (questionIsCopyLike(a?.sharedQuestion, standard)) out.push("sharedQuestion");
  return out;
}
