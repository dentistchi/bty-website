/**
 * THE GRAMMATICAL FLOOR ON AN OBSERVABLE STANDARD — one rule, two consumers (Slice R4-R1A).
 *
 * `isInterrogativeAction` was written for Slice 3.2P-R2.1 and lived inside `program-coherence`,
 * where it guards the MODEL's proposed action. R4-R1A measured that the same defect reaches the
 * product by an entirely different road: a HOST typed a question into `observableBehavior`, the
 * deterministic Journey mapper copied it faithfully into `observable_standard`, and the
 * observation surface then asked a colleague "did you personally see or hear:
 * 'At the next huddle, what exact words will you use…?'".
 *
 * Both roads need the same floor, and `program-coherence` already imports `journey`, so the rule
 * cannot simply be imported the other way. It lives here instead — ONE implementation that both
 * sides depend on. `program-coherence` re-exports it, so every 3.2P caller and fixture is
 * untouched and no second, drifting copy of "a question is not a behaviour" exists.
 *
 * Nothing about the predicate changed in the move. The doc below is 3.2P's, because the
 * reasoning is still exactly why it is shaped this way.
 *
 * ---
 *
 * MEASURED ON THE LIVE PILOT. The Host's stored `observableBehavior` for
 * "End Every Huddle With an Owner and Deadline" is, verbatim:
 *
 *   "At the next huddle, what exact words will you use to confirm the owner, action, and deadline?"
 *
 * DELIBERATELY NARROW. Two signals, both unambiguous, chosen against the real corpus of
 * observable actions in this repository and on staging:
 *
 *   1. terminal question mark — `?` / `？`. Korean questions carry one too, so the rule is not
 *      English-only by accident.
 *   2. SUBJECT-AUXILIARY INVERSION under a wh-head — "what … will you", "how … does the team".
 *      That shape is a question in a way a bare wh-head is not.
 *
 * A BARE WH-HEAD WAS TRIED AND REJECTED, by 3.2P's own fixtures. "when in doubt, name the owner
 * out loud" is an ordinary conditional action, and `when`/`where`/`how` open adverbial clauses
 * constantly. So the head alone is not evidence, and the inversion has to appear before the
 * first clause boundary — a comma ends the search, which is what keeps that sentence passing.
 *
 * WHAT IT MUST NOT REFUSE, and does not: an action ABOUT asking or checking. "Ask the patient to
 * confirm the date", "Check whether the owner is named", "Confirm who owns the action", "Record
 * the deadline" — every one has a verb head and no terminal question mark. The distinction is
 * interrogative SHAPE, not interrogative vocabulary, which is why a keyword list was rejected:
 * "confirm who owns it" is the behaviour this very training teaches.
 *
 * Anything genuinely ambiguous without punctuation — "which action needs an owner" — is left
 * ACCEPTED on purpose. A false refusal costs a Host a legitimate program; the marked and
 * inverted forms already cover the measured defect.
 */
const AUXILIARIES =
  "will|would|can|could|should|shall|do|does|did|is|are|was|were|am|have|has|had|may|might|must";
const SUBJECTS = "you|we|they|i|he|she|it|the|a|an|your|our|their|his|her|its|this|that|people|someone|anyone";
/** wh-word … auxiliary + subject, all before the first clause boundary. */
const INTERROGATIVE_INVERSION = new RegExp(
  `^(?:what|which|who|whom|whose|when|where|why|how)\\b[^,.;:?!]{0,60}?\\b(?:${AUXILIARIES})\\s+(?:${SUBJECTS})\\b`,
  "i",
);

export function isInterrogativeAction(action: string): boolean {
  const t = action.replace(/\s+/g, " ").trim();
  if (t.length === 0) return false; // emptiness is `missing`, a different and earlier defect
  if (/[?？]\s*$/.test(t)) return true;
  return INTERROGATIVE_INVERSION.test(t);
}

/**
 * May this sentence carry the authority of an INDEPENDENTLY OBSERVABLE STANDARD?
 *
 * The question an observer is asked is "did you personally see or hear THIS". That only has a
 * truthful answer when "this" is something that happened in the world. A question, an intention
 * or a prompt has no answer of that kind — a colleague confronted with one can only guess what
 * they are being asked to confirm, and whatever they then attest to is not the behaviour.
 *
 * WHAT THIS IS NOT. It is not a quality score, a specificity test, or a judgement about whether
 * the standard is a GOOD one. Vagueness has its own advisory heuristic
 * (`observableBehaviorWarning`) and stays advisory, because a Host writing loosely is writing
 * something real. This refuses only the shape that cannot be observed at all, which is the
 * narrowest claim the evidence supports.
 *
 * Emptiness is NOT decided here — a missing standard is already "no observation path" everywhere
 * it matters, and conflating the two would make a blank field report as a grammar fault.
 */
export function isObservableStandardShape(text: string): boolean {
  return !isInterrogativeAction(text);
}
