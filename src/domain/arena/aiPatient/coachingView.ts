/**
 * AI PATIENT — the coaching view (pure). Issue #69.
 *
 * The Founder's pilot verdict on the first feedback screen: "it feels like being criticized and
 * evaluated" — a seven-row report card of Seen / Partly / Not seen / Unclear. The goal is Courage,
 * Comfort and Help: the learner leaves informed, respected and ready to try one better approach.
 *
 * This shapes the ALREADY-RECONCILED feedback (quotes checked against the learner's own turns, the
 * independent safety screen merged, coherence rules applied) into three short sections:
 *
 *   What helped the patient   — behaviours SEEN with a verified quote; failing that, one modest
 *                               observation backed by a verified quote; failing that, a neutral line.
 *                               No quote, no praise.
 *   One thing to handle differently — ONE primary point: the most consequential safety theme, else
 *                               one gap. Any further safety theme stays visible, briefly, never hidden.
 *   Try next time             — at most two short authored steps, the second tied to the primary point.
 *
 * Coaching Tone V1 (Founder device review): nothing here counts. "This came up 3 times" read as a
 * score, so repetition is grouped silently into one point and never shown as a number.
 *
 * Everything said TO the learner here is authored text below (Founder-reviewable), tied to their
 * verified words. The model's own notes stay in the optional details. Nothing is scored.
 *
 * Pure: no I/O.
 */

import type { ConcernKind, FeedbackBehaviorKey, ShownConcern, ShownFeedback, ShownObservation } from "./feedback";

/** Safety first, and in this order: clinical authority, financial honesty, the patient's own pace. */
export const CONCERN_ORDER: readonly ConcernKind[] = ["clinical_misrepresentation", "insurance_guarantee", "pressure_or_urgency", "other"];

/** Authored, Founder-reviewable. The example lines give no clinical or coverage advice of their own. */
export const SAFETY_COACHING: Record<ConcernKind, { title: string; whyItMatters: string; tryInstead: string }> = {
  clinical_misrepresentation: {
    title: "Leave the clinical picture to the dentist",
    whyItMatters:
      "Only the treating dentist can explain what the tooth needs and how urgent it is. When that gets softened or changed, the patient decides on information the dentist never gave.",
    tryInstead: "That's a really good question for Dr. Patel. Would you like me to ask her to come back and explain?",
  },
  insurance_guarantee: {
    title: "Keep cost and coverage to what's confirmed",
    whyItMatters:
      "Coverage hasn't been confirmed, so a promise about what insurance will pay can leave the patient with a bill they didn't expect.",
    tryInstead:
      "This is only an estimate, and your insurance hasn't confirmed coverage. Let's review what we know and what still needs to be checked before you decide.",
  },
  pressure_or_urgency: {
    title: "Let the patient set the pace",
    whyItMatters:
      "Pressure to decide now can lead a patient to agree before they're ready, or to stop trusting the office. Going ahead, waiting or saying no is their choice.",
    tryInstead: "You don't have to decide this minute. Dr. Patel said this isn't an emergency, but she wouldn't leave it for a long time. Would you like me to ask her to explain the timing?",
  },
  other: {
    title: "Keep the decision with the patient",
    whyItMatters: "Every patient has the right to take time, ask more questions or say no.",
    tryInstead: "What would feel right for you as a next step?",
  },
};

/** Said only when that behaviour was SEEN and backed by the learner's own verified words. */
export const HELPED_TEXT: Record<FeedbackBehaviorKey, string> = {
  open_question: "You asked about the patient's hesitation before explaining.",
  found_concern: "You gave the patient room to say what was really worrying them.",
  told_apart: "You checked whether the hesitation was about the cost or about the treatment itself.",
  referred_clinical: "You brought a clinical question back to the dentist.",
  accurate_money: "You kept the estimate and insurance accurate.",
  no_pressure: "You kept the conversation free of pressure.",
  respected_choice: "You made it okay for the patient to take their time.",
};

/** One gap, phrased as something to try — used only when there is no safety concern. */
export const GROWTH_TEXT: Record<FeedbackBehaviorKey, string> = {
  open_question: "Before explaining, ask one open question, like “What part of this feels hardest right now?”",
  found_concern: "Give the patient a moment to name what's really on their mind before offering solutions.",
  told_apart: "Check what the hesitation is about: “Is it more the cost, or more whether you need it?”",
  referred_clinical: "When a clinical question comes up, offer to bring the dentist back rather than answering it yourself.",
  accurate_money: "Describe the estimate as an estimate, and say what insurance hasn't confirmed yet.",
  no_pressure: "Leave room for the patient to decide without a deadline.",
  respected_choice: "Let the patient know that waiting or saying no is okay.",
};

/** Plain words for the optional details. Model uncertainty is never framed as the learner's failure. */
export const DETAIL_STATUS: Record<ShownObservation["status"], string> = {
  seen: "Heard in your words",
  partly: "Partly",
  not_seen: "Not this time",
  not_applicable: "Didn't come up",
  unclear: "Couldn't confirm",
};

/**
 * When nothing was clearly SEEN but the learner verifiably moved toward the patient's concern (a
 * PARTLY observation or "got close to it", each backed by a verified, unflagged quote of their own).
 */
export const MODEST_HELP = "One thing worth building on is that you stayed engaged with the patient's concern.";
/** Nothing honest to build on. Neutral, not discouraging, and never invented praise. */
export const NO_VERIFIED_HELP = "The conversation was short, so there wasn't enough evidence yet to call out a specific strength.";
export const NOTHING_TO_CHANGE = "Nothing stood out to change in this conversation.";

export type SafetyPoint = {
  kind: ConcernKind;
  title: string;
  /** The learner's words that raised it. Verified quotes come first. */
  quote: string;
  quoteVerified: boolean;
  whyItMatters: string;
  tryInstead: string;
  /** The other quotes on the same theme, for the details. */
  otherQuotes: Array<{ quote: string; verified: boolean }>;
};

export type CoachingView = {
  /** `engaged` is the modest observation (MODEST_HELP), used only when no behaviour was clearly seen. */
  helped: Array<{ key: FeedbackBehaviorKey | "engaged"; text: string; quote: string }>;
  /** Shown instead of praise when nothing could be verified. Never invented praise. */
  helpedFallback: string | null;
  /**
   * Every safety theme, most consequential first. Never empty when a concern exists. The first is the
   * primary point; the rest are shown briefly so a safety concern is never hidden.
   */
  safety: SafetyPoint[];
  /** The single gap to work on — only when there is no safety concern. */
  growth: { key: FeedbackBehaviorKey; text: string } | null;
  growthFallback: string | null;
  /** At most two short steps. The review's own longer next step stays in the details. */
  tryNext: string[];
};

/** The first habit for every round: understand before explaining. */
export const TRY_FIRST = "Ask an open question first.";
/** The second step follows the primary point. The default is the clinical-referral habit. */
export const TRY_THEN: Record<ConcernKind | FeedbackBehaviorKey | "default", string> = {
  default: "If the patient asks a clinical question, bring the dentist in.",
  clinical_misrepresentation: "If the patient asks a clinical question, bring the dentist in.",
  insurance_guarantee: "If cost or coverage comes up, call it an estimate until insurance confirms it.",
  pressure_or_urgency: "If the patient hesitates, let them set the pace.",
  other: "Ask what would feel right to them as a next step.",
  open_question: "If the patient asks a clinical question, bring the dentist in.",
  found_concern: "Let the patient name what's really on their mind before offering a solution.",
  told_apart: "Check whether it's more the cost or more whether they need it.",
  referred_clinical: "If the patient asks a clinical question, bring the dentist in.",
  accurate_money: "If cost or coverage comes up, call it an estimate until insurance confirms it.",
  no_pressure: "If the patient hesitates, let them set the pace.",
  respected_choice: "Let the patient know that waiting or saying no is okay.",
};

const BEHAVIOR_ORDER: readonly FeedbackBehaviorKey[] = [
  "open_question",
  "found_concern",
  "told_apart",
  "referred_clinical",
  "accurate_money",
  "no_pressure",
  "respected_choice",
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function groupSafety(concerns: ShownConcern[]): SafetyPoint[] {
  const byKind = new Map<ConcernKind, ShownConcern[]>();
  for (const c of concerns) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
  const points: SafetyPoint[] = [];
  for (const kind of CONCERN_ORDER) {
    const list = byKind.get(kind);
    if (!list?.length) continue;
    // One event per distinct line: the same words flagged twice are one problem, not two.
    const distinct: ShownConcern[] = [];
    for (const c of [...list].sort((a, b) => Number(b.quoteVerified) - Number(a.quoteVerified))) {
      if (!distinct.some((d) => norm(d.quote) === norm(c.quote))) distinct.push(c);
    }
    const head = distinct[0]!;
    points.push({
      kind,
      ...SAFETY_COACHING[kind],
      quote: head.quote,
      quoteVerified: head.quoteVerified,
      otherQuotes: distinct.slice(1).filter((d) => Boolean(d.quote)).map((d) => ({ quote: d.quote, verified: d.quoteVerified })),
    });
  }
  return points;
}

export function buildCoachingView(feedback: ShownFeedback): CoachingView {
  const byKey = new Map(feedback.observations.map((o) => [o.key, o]));

  const helped = BEHAVIOR_ORDER.flatMap((key) => {
    const o = byKey.get(key);
    // Reconciliation already guarantees `seen` quotes are the learner's own and never a flagged line.
    if (!o || o.status !== "seen" || o.quotes.length === 0) return [];
    return [{ key, text: HELPED_TEXT[key], quote: o.quotes[0]! }];
  }).slice(0, 2);

  // Only when nothing was clearly seen: a modest, quote-backed observation that the learner moved
  // toward the patient's concern. Reconciliation already dropped any quote that is not the learner's
  // own or that sits on a flagged line.
  const ENGAGEMENT: readonly FeedbackBehaviorKey[] = ["open_question", "found_concern", "told_apart"];
  const engagedQuote = helped.length
    ? null
    : (ENGAGEMENT.map((key) => byKey.get(key)).find((o) => o?.status === "partly" && o.quotes.length > 0)?.quotes[0] ??
      (feedback.concernSurfaced.status === "partly" && feedback.concernSurfaced.quote ? feedback.concernSurfaced.quote : null));
  const shownHelped: CoachingView["helped"] = engagedQuote ? [{ key: "engaged", text: MODEST_HELP, quote: engagedQuote }] : helped;

  const safety = groupSafety(feedback.concerns);

  const gapKey = safety.length
    ? null
    : (BEHAVIOR_ORDER.find((key) => {
        const s = byKey.get(key)?.status;
        return s === "not_seen" || s === "partly";
      }) ?? null);

  const focus = safety[0]?.kind ?? gapKey ?? "default";

  return {
    helped: shownHelped,
    helpedFallback: shownHelped.length ? null : NO_VERIFIED_HELP,
    safety,
    growth: gapKey ? { key: gapKey, text: GROWTH_TEXT[gapKey] } : null,
    growthFallback: safety.length || gapKey ? null : NOTHING_TO_CHANGE,
    tryNext: [TRY_FIRST, TRY_THEN[focus]],
  };
}
