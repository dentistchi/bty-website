/**
 * WHAT A LEARNER QUESTION ASKS FOR — advisory only (Slice R4-R5C12A).
 *
 * R4-R5C11 stopped BTY's own renderers from saying the behaviour seven times. It did not touch
 * the two sections that ASK the learner something, and measurement across the live corpus found
 * the repetition had simply moved there:
 *
 *   REFLECT             15 of 16 shared questions were BYTE-IDENTICAL to one BTY-authored
 *                       default that names the standard as the answer. Zero asked about current
 *                       practice.
 *   BEFORE YOU FINISH   22 of 37 completion questions overlap the observable standard at 0.50 or
 *                       more; 8 carry effectively its whole vocabulary; 10 came out of a BTY
 *                       template that interpolates the standard INTO the question.
 *
 * TWO SIGNALS, BECAUSE ONE IS PROVABLY NOT ENOUGH. Lexical overlap catches the completion family
 * and MISSES the REFLECT default completely — "what is the most important standard from this
 * training?" shares almost no WORDS with any standard while asking for exactly it (measured: 0
 * of 16 reached 0.50). Stem shape catches the REFLECT family and only 5 of 37 completions. A
 * single threshold would have declared the worse of the two defects clean, so both are computed
 * and the caller sees both.
 *
 * ADVISORY, NOT POLICY. Nothing here refuses, blocks or rewrites. A Host is authoritative about
 * their own question; BTY may tell the truth about what it will produce (R4-R7A).
 *
 * THIS FILE IMPORTS NOTHING, and that is load-bearing rather than tidy. `journey.ts` has to ask
 * whose sentence a shared question is, and `program-authorship.ts` already imports `journey.ts`
 * — so the recognisers live here, below both, and the classifier that needs `overlapRatio` lives
 * in `learnerQuestionRole.ts` above them. Keeping them in one file would have closed a cycle.
 */

// ---------------------------------------------------------------------------
// Whose sentence is it? — the provenance question, answered without a migration
// ---------------------------------------------------------------------------

/**
 * NO DURABLE AUTHORSHIP SIGNAL EXISTS for these two fields, and this file does not invent one.
 *
 * Measured before writing a line: `BuilderAnswers.sharedQuestion` and `.completionPrompt` are
 * plain `string?`. There is no touched flag, no proposal origin, no source metadata and no edit
 * decision recorded anywhere for either. The only durable distinction the shape supports is
 * ABSENCE — since Slice 3.2L-R11.4B the suggestion is DISPLAYED and never patched, so an
 * untouched field stays `undefined`. That distinction is real and is used first.
 *
 * For a value that is already stored, the fallback the dispatch permits is exact recognition of
 * BTY's own published default strings. Its limitation, stated plainly: a Host who selects the
 * prefilled sentence and retypes it character for character is indistinguishable from a Host who
 * left it alone, and both are treated as BTY's. Nothing similar is captured — the match is exact
 * after trimming, never fuzzy, so a Host sentence that merely RESEMBLES a default keeps full Host
 * authority. Adding a column to settle this properly is a separate decision, deliberately not
 * taken here.
 */
export const BTY_SUGGESTED_SHARED_QUESTIONS: readonly string[] = [
  // CURRENT (R4-R5C12A) — current practice.
  "What usually happens when you are in this situation today?",
  "지금은 이런 상황에서 보통 어떻게 하고 있나요?",
  // LEGACY (Slice 3.1B-3G) — standard recall. Kept so the 15 live drafts carrying it are still
  // recognised as BTY's sentence rather than mistaken for the Host's.
  "In your own words, what is the most important standard from this training?",
  "이 교육에서 가장 중요한 행동 기준을 자신의 말로 설명해 주세요.",
];

/** BTY's own completion suggestions, current and legacy-with-no-behaviour-to-quote. */
export const BTY_SUGGESTED_COMPLETION_PROMPTS: readonly string[] = [
  // CURRENT (R4-R5C12A) — learner-owned decision, quoting nothing.
  "What is one thing you will do differently the next time this happens?",
  "다음에 이런 상황이 생기면 한 가지 무엇을 다르게 해보겠습니까?",
  // LEGACY (Slice 2.3A) — the no-behaviour branch of the old template.
  "What is one thing you will apply this week?",
  "이번 주에 적용할 한 가지는 무엇인가요?",
];

const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Is this exactly a sentence BTY prefilled, rather than one the Host wrote? */
export function isBtySuggestedSharedQuestion(v: unknown): boolean {
  const s = trimmed(v);
  return s.length > 0 && BTY_SUGGESTED_SHARED_QUESTIONS.includes(s);
}

/**
 * The legacy completion template interpolated the Host's own behaviour into the question, so its
 * output is not a fixed string. Both localized shapes are recognised by their frame — and only by
 * their frame, so an ordinary Host question that happens to open on a quotation is not captured.
 */
const LEGACY_COMPLETION_TEMPLATE = [
  /^Thinking about "[\s\S]+", what is one thing you will apply this week\?$/,
  /^"[\s\S]+" — 이번 주에 적용할 한 가지는 무엇인가요\?$/,
];

export function isBtySuggestedCompletionPrompt(v: unknown): boolean {
  const s = trimmed(v);
  if (s.length === 0) return false;
  if (BTY_SUGGESTED_COMPLETION_PROMPTS.includes(s)) return true;
  return LEGACY_COMPLETION_TEMPLATE.some((re) => re.test(s));
}

