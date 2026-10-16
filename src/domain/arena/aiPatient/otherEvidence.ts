/**
 * AI PATIENT — the evidence gate for `other` safety findings (pure, shared by every scenario).
 *
 * Measured: on Scenario Pack V1's live gate the safety screen flagged "What would work best for you if
 * today isn't possible?" as `other` twice — first as a redirect, then, once omissions were ruled out,
 * as an implied promise. The verdict was stable and the reason was not. So `other` is no longer taken
 * on the model's word: a finding stands only when it names a concrete unsafe ACT and quotes the
 * learner's own words that ARE that act, and the words actually express it.
 *
 * Small and conservative on purpose: an uncertain pair is dropped. clinical_misrepresentation,
 * insurance_guarantee and pressure_or_urgency are untouched by this file.
 */

import { normalizeQuote } from "./quoteMatch";

/** Concrete unsafe acts only. There is deliberately no "omission", "did not answer" or "other". */
export const OTHER_ACTS = ["invented_fact", "unchecked_promise", "denial_or_dismissal", "removes_choice", "pressure", "clinical_claim"] as const;
export type OtherAct = (typeof OTHER_ACTS)[number];

export const isOtherAct = (v: unknown): v is OtherAct => typeof v === "string" && (OTHER_ACTS as readonly string[]).includes(v);

/**
 * Words that hedge or condition a claim ("if today isn't possible", "let me check", "I'm not sure").
 * Matched on normalized text, where apostrophes are spaces ("isn't" → "isn t").
 */
const UNCERTAIN = /\b(?:if|whether|might|maybe|possibly|let me check|i ll check|check with|find out|not sure|don t know|do not know)\b/;
/** A promise is also void when negated: "I can't promise today", "we won't know until…". */
const NEGATED = /\b(?:can t|cannot|can not|won t|wouldn t|isn t|aren t|not|no way|promise)\b/;

/** What each act's words must contain. A pair matching none of its patterns is dropped. */
const ACT_PATTERNS: Record<OtherAct, RegExp[]> = {
  unchecked_promise: [
    // A commitment needs a concrete object: "we can get it done", "we can see you" — not "we can see what…".
    /\b(?:we|i|she|he|dr \w+|they)(?: can| ll| will| could| are going to| re going to)(?: definitely| absolutely| just| easily| still)? (?:get (?:it|you|that|this|the crown)|do (?:it|that|this|the crown)|squeeze you|fit you|finish (?:it|today|the crown)|start (?:it|today|the crown)|see you|take care of (?:it|that|this|you)|have (?:it|you|that) (?:done|in|ready))\b/,
    /\b(?:it|this|that|the crown|your crown)(?: will| ll| is going to)(?: definitely| absolutely)? be (?:done|finished|ready|completed)\b/,
    /\bno problem\b/,
    /\bsqueeze you in\b/,
  ],
  denial_or_dismissal: [
    /\bthat s not (?:what|how|true|right)\b/,
    /\bthat (?:didn t|never) happen/,
    /\bi m sure (?:someone|somebody|they|we|she|he|it)\b/,
    /\b(?:wouldn t|would never|doesn t|does not|don t|never) do that\b/,
    /\balways explains?\b/,
    /\bknows best\b/,
    /\bjust trust\b/,
  ],
  invented_fact: [
    /\$ ?\d|\b\d+ ?(?:dollars|bucks)\b|\b(?:hundred|thousand) dollars\b|\b(?:about|only|just) (?:a |one |two |three |four |five |six |seven |eight |nine )?(?:hundred|thousand)\b/,
    /\bpolicy\b/,
    /\bwe (?:only|always|never|don t|do not) (?:offer|take|accept|do|allow)\b/,
    /\b(?:our office|the office|we|they|insurance) (?:always|never)\b/,
  ],
  removes_choice: [
    /\byou (?:have to|need to|must|ve got to|got to)\b/,
    /\byou ll have to\b/,
    /\b(?:no|don t have a) choice\b/,
    /\byou should just\b/,
  ],
  pressure: [
    /\byou (?:have to|need to|must|should just)\b/,
    /\byou (?:really )?need (?:this|it|to)\b/,
    /\bright now\b|\bbefore it s too late\b|\bgoes up\b|\bonly today\b|\btoday only\b/,
    /\blet s just (?:get|book|do)\b/,
  ],
  clinical_claim: [
    /\b(?:will|ll|going to) (?:get worse|spread|split|break|crack|hurt|shift)\b/,
    /\bwon t hurt\b|\byou ll be fine\b|\bnothing to worry\b/,
    /\b(?:only|just) takes? one visit\b|\bone visit\b/,
    /\b(?:better|smarter|right) (?:choice|option)\b|\bmistake\b|\bregret\b/,
    /\byou (?:really )?need (?:this|it|a|the)\b/,
    /\b(?:tiny|minor|nothing|just being cautious)\b/,
  ],
};

/** Normalized for matching: lower case, apostrophes and punctuation as spaces. */
const words = (s: string): string => ` ${normalizeQuote(s).replace(/'/g, " ").replace(/\s+/g, " ").trim()} `;

/**
 * Accept an `other` finding only when `act` is a concrete unsafe act, `evidence` is the learner's own
 * words from THIS line (at least two words), and the words themselves express that act.
 */
export function acceptOtherFinding(act: unknown, evidence: unknown, learnerLine: string): boolean {
  if (!isOtherAct(act) || typeof evidence !== "string") return false;
  const ev = normalizeQuote(evidence);
  if (ev.split(" ").filter(Boolean).length < 2) return false;
  if (!normalizeQuote(learnerLine).includes(ev)) return false;
  const w = words(evidence);
  if ((act === "unchecked_promise" || act === "invented_fact") && UNCERTAIN.test(w)) return false;
  if (act === "unchecked_promise" && NEGATED.test(w)) return false;
  return ACT_PATTERNS[act].some((re) => re.test(w));
}
