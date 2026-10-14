/**
 * AI PATIENT — coaching feedback contract (pure).
 *
 * Feedback is about what the learner observably SAID, never a grade. Every observation must quote the
 * learner's own words; the server checks each quote against the transcript before anything is shown,
 * so a model's claim about the conversation never stands without the conversation behind it.
 *
 * Nothing here scores, ranks or certifies. A model's assertion is not evidence of compliance, and the
 * screen says so.
 */

import { CASE_ACCEPTANCE_01, type AiPatientCase, type HiddenConcern } from "./caseAcceptance01";
import type { Turn } from "./sessionRules";
import type { ChatMessage } from "./patientPrompt";
import type { ScreenFinding } from "./safetyScreen";

export const FEEDBACK_BEHAVIORS = [
  { key: "open_question", label: "Asked an open question before explaining more" },
  { key: "found_concern", label: "Listened for the patient's actual concern" },
  { key: "told_apart", label: "Told a money limit apart from doubt about the treatment" },
  { key: "referred_clinical", label: "Brought clinical questions back to the treating dentist" },
  { key: "accurate_money", label: "Stayed accurate about insurance and cost" },
  { key: "no_pressure", label: "Avoided pressure and invented urgency" },
  { key: "respected_choice", label: "Respected the patient's choice to go ahead, wait or decline" },
] as const;
export type FeedbackBehaviorKey = (typeof FEEDBACK_BEHAVIORS)[number]["key"];

export const OBSERVATION_STATUSES = ["seen", "partly", "not_seen", "not_applicable"] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

export const CONCERN_KINDS = ["clinical_misrepresentation", "insurance_guarantee", "pressure_or_urgency", "other"] as const;
export type ConcernKind = (typeof CONCERN_KINDS)[number];

/** What the model must return. Strict JSON schema below mirrors it exactly. */
export type RawFeedback = {
  observations: Array<{ key: FeedbackBehaviorKey; status: ObservationStatus; quotes: string[]; note: string }>;
  concerns: Array<{ kind: ConcernKind; quote: string; explanation: string }>;
  concernSurfaced: { status: "yes" | "partly" | "no"; quote: string };
  nextStep: string;
};

/** Strict structured output does not accept length keywords; lengths are bounded when reconciling. */
const str = (_maxLength: number) => ({ type: "string" }) as const;

export const FEEDBACK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["observations", "concerns", "concernSurfaced", "nextStep"],
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "status", "quotes", "note"],
        properties: {
          key: { type: "string", enum: FEEDBACK_BEHAVIORS.map((b) => b.key) },
          status: { type: "string", enum: [...OBSERVATION_STATUSES] },
          quotes: { type: "array", items: str(300) },
          note: str(300),
        },
      },
    },
    concerns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "quote", "explanation"],
        properties: { kind: { type: "string", enum: [...CONCERN_KINDS] }, quote: str(300), explanation: str(300) },
      },
    },
    concernSurfaced: {
      type: "object",
      additionalProperties: false,
      required: ["status", "quote"],
      properties: { status: { type: "string", enum: ["yes", "partly", "no"] }, quote: str(300) },
    },
    nextStep: str(400),
  },
} as const;

/** Lines are labelled so the reviewer can only quote the learner from the learner's own turns. */
export function transcriptText(turns: Turn[], kase: AiPatientCase = CASE_ACCEPTANCE_01): string {
  return turns.map((t, i) => `${i + 1}. ${t.role === "tc" ? "TREATMENT COORDINATOR" : `PATIENT (${kase.patientName})`}: ${t.text}`).join("\n");
}

export function buildFeedbackMessages(concern: HiddenConcern, turns: Turn[], kase: AiPatientCase = CASE_ACCEPTANCE_01): ChatMessage[] {
  const hidden = kase.hiddenConcerns[concern];
  return [
    {
      role: "system",
      content: [
        "You are a careful dental-practice communication coach reviewing a PRACTICE conversation between a Treatment Coordinator (TC) and a fictional patient played by an AI.",
        "WHAT IS ACTUALLY TRUE IN THIS CASE:",
        ...kase.reviewerFacts.map((f) => `- ${f}`),
        `The patient's hidden concern in this session was ${hidden.label}. The TC did not know this in advance.`,
        "Judge ONLY what the TC actually said. Do not infer intentions or credit things that were not said.",
        "BEHAVIORS — for each give a status: seen, partly, not_seen, or not_applicable (only when the situation never arose).",
        "- open_question: the TC asked an open question about the patient's hesitation before explaining or selling.",
        "- found_concern: the TC listened and brought the patient's actual concern into the open.",
        "- told_apart: the TC checked whether the hesitation was about money or about whether the treatment is needed, instead of assuming.",
        "- referred_clinical: when a clinical question arose, the TC offered to get the dentist or said the dentist should answer it. It is NOT seen if the TC answered a clinical question themselves, minimized the problem, or suggested a different treatment.",
        "- accurate_money: the TC described the estimate and insurance accurately (an estimate, coverage not confirmed) and promised nothing.",
        "- no_pressure: the TC did not push for a booking, invent deadlines, or create fear.",
        "- respected_choice: the TC accepted the patient's wish to wait, decline or decide later.",
        "For seen or partly, quote the TC's exact words (copied character for character from a TREATMENT COORDINATOR line; at most two short quotes). A line that you list as a concern must NEVER be quoted as evidence of a good behavior. Keep each note to one plain sentence written to the TC as 'you' (never 'the TC').",
        "CONCERNS — list every TC line that could mislead or pressure a patient: clinical_misrepresentation (changing, softening, reinterpreting or second-guessing the dentist's recommendation, e.g. calling it minor, saying the dentist is just being cautious, saying it can wait a long time, offering a different treatment; inventing clinical facts or urgency); insurance_guarantee (promising or confidently stating what insurance will pay when coverage is not confirmed); pressure_or_urgency (pushing to book now, deadlines, price expiries, fear); other (anything else that disrespects the patient's right to decide, or invents a policy or payment option). Quote the TC exactly. If there are none, return an empty list.",
        "concernSurfaced: did the TC bring the patient's actual concern into the open? Quote the TC's words that did it, or an empty string.",
        "nextStep: one or two sentences with one specific thing to try in the next real conversation, written to the TC as 'you'.",
        "TONE: you are a supportive senior colleague, not an examiner. Write notes and nextStep warmly and plainly, the way you would talk to someone you want to see succeed. Describe what was said and what to try; never label the TC (no 'failed', 'poor', 'weak', 'should have known').",
        "Never give a score, grade, rating, percentage or pass/fail. Never claim the TC is competent or certified. Never comment on real patients or outcomes.",
      ].join("\n"),
    },
    { role: "user", content: `Transcript:\n${transcriptText(turns, kase)}` },
  ];
}

// ---------------------------------------------------------------------------
// Evidence check
// ---------------------------------------------------------------------------

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'$%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when `quote` is the learner's own words: a normalized substring of one of their turns. */
export function isLearnerQuote(quote: string, turns: Turn[]): boolean {
  const q = normalize(quote);
  if (q.length < 3) return false;
  return turns.some((t) => t.role === "tc" && normalize(t.text).includes(q));
}

export type ShownObservation = {
  key: FeedbackBehaviorKey;
  label: string;
  /** `unclear` = the model claimed it but its quote is not in the transcript. */
  status: ObservationStatus | "unclear";
  quotes: string[];
  note: string;
};

export type ShownConcern = {
  kind: ConcernKind;
  quote: string;
  explanation: string;
  quoteVerified: boolean;
  /** `screen` = the dedicated safety screen (quote is the learner's line by construction); `coach` = the coaching review. */
  source: "screen" | "coach";
};

export type ShownFeedback = {
  hiddenConcern: { key: HiddenConcern; label: string };
  concernSurfaced: { status: "yes" | "partly" | "no" | "unclear"; quote: string };
  observations: ShownObservation[];
  concerns: ShownConcern[];
  nextStep: string;
  /** Raised whenever a possible safety concern exists — a prompt to talk to a person, never an automated notice. */
  suggestMentorReview: boolean;
  /** Whether the dedicated safety screen ran. When it did not, the screen says so instead of implying a clean check. */
  safetyScreen: "ran" | "unavailable";
};

/** Model text is bounded here, because strict structured output cannot bound it. */
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A concern in one area means the matching good behavior cannot be credited in the same conversation. */
export const BEHAVIORS_BLOCKED_BY: Record<ConcernKind, FeedbackBehaviorKey[]> = {
  clinical_misrepresentation: ["referred_clinical"],
  insurance_guarantee: ["accurate_money"],
  pressure_or_urgency: ["no_pressure", "respected_choice"],
  other: ["respected_choice"],
};

/** The learner turn a quote came from, or -1. */
function turnOfQuote(quote: string, turns: Turn[]): number {
  const q = normalize(quote);
  if (q.length < 3) return -1;
  return turns.findIndex((t) => t.role === "tc" && normalize(t.text).includes(q));
}

/**
 * Reconcile the reviews with the transcript.
 *
 *  - An observation claimed as seen/partly keeps only quotes that are really the learner's; with none
 *    left it becomes `unclear` instead of being credited.
 *  - Every behavior is reported exactly once, in a fixed order; a missing one is `unclear`.
 *  - The safety screen's findings come first; a coaching concern on the same line and kind is merged.
 *  - A possible safety concern is KEPT even if its quote does not match exactly — hiding a real
 *    problem because of a paraphrase is the worse error — but it is marked as unverified.
 *  - COHERENCE: a line flagged as a concern is never quoted as evidence of a good behavior, and a
 *    concern in one area means the matching behavior is not credited (measured: the first live run
 *    credited "brought clinical questions back to the dentist" with the very line that undermined
 *    the dentist).
 */
export function reconcileFeedback(
  raw: RawFeedback,
  concern: HiddenConcern,
  turns: Turn[],
  screen: ScreenFinding[] | null = null,
  kase: AiPatientCase = CASE_ACCEPTANCE_01,
): ShownFeedback {
  // ---- concerns: screen first, then coaching concerns that add something new
  const concerns: ShownConcern[] = (screen ?? []).map((f) => ({
    kind: f.kind,
    quote: clip(turns[f.turnIndex]!.text, 300),
    explanation: clip(f.explanation, 300),
    quoteVerified: true,
    source: "screen" as const,
  }));
  const screenKeys = new Set((screen ?? []).map((f) => `${f.turnIndex}|${f.kind}`));
  for (const c of raw.concerns) {
    if (!c.quote.trim() && !c.explanation.trim()) continue;
    const at = turnOfQuote(c.quote, turns);
    if (at >= 0 && screenKeys.has(`${at}|${c.kind}`)) continue;
    concerns.push({ kind: c.kind, quote: clip(c.quote, 300), explanation: clip(c.explanation, 300), quoteVerified: at >= 0, source: "coach" });
  }
  concerns.splice(6);

  const flaggedTurns = new Set<number>([
    ...(screen ?? []).map((f) => f.turnIndex),
    ...concerns.map((c) => turnOfQuote(c.quote, turns)).filter((i) => i >= 0),
  ]);
  const blocked = new Set<FeedbackBehaviorKey>(concerns.flatMap((c) => BEHAVIORS_BLOCKED_BY[c.kind]));

  // ---- observations
  const byKey = new Map(raw.observations.map((o) => [o.key, o]));
  const observations: ShownObservation[] = FEEDBACK_BEHAVIORS.map(({ key, label }) => {
    const o = byKey.get(key);
    if (!o) return { key, label, status: "unclear", quotes: [], note: "Not covered in this review." };
    const positive = o.status === "seen" || o.status === "partly";
    if (positive && blocked.has(key)) {
      return { key, label, status: "not_seen", quotes: [], note: "Not counted this time, because of the point about this in your coaching." };
    }
    const quotes = o.quotes
      .filter((q) => {
        const at = turnOfQuote(q, turns);
        return at >= 0 && !flaggedTurns.has(at);
      })
      .slice(0, 2)
      .map((q) => clip(q, 300));
    if (positive && quotes.length === 0) {
      return { key, label, status: "unclear", quotes: [], note: "We couldn't confirm that from this conversation." };
    }
    return { key, label, status: o.status, quotes: positive ? quotes : [], note: clip(o.note, 300) };
  });

  const surfacedAt = raw.concernSurfaced.quote.trim() ? turnOfQuote(raw.concernSurfaced.quote, turns) : -1;
  const surfacedOk = surfacedAt >= 0 && !flaggedTurns.has(surfacedAt);
  const concernSurfaced =
    raw.concernSurfaced.status !== "no" && !surfacedOk
      ? { status: "unclear" as const, quote: "" }
      : { status: raw.concernSurfaced.status, quote: surfacedOk ? clip(raw.concernSurfaced.quote, 300) : "" };

  return {
    hiddenConcern: { key: concern, label: kase.hiddenConcerns[concern].label },
    concernSurfaced,
    observations,
    concerns,
    nextStep: clip(raw.nextStep.trim(), 400),
    suggestMentorReview: concerns.length > 0,
    safetyScreen: screen ? "ran" : "unavailable",
  };
}

/** Structural check of the model's JSON before reconciliation. */
export function parseRawFeedback(v: unknown): RawFeedback | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.observations) || !Array.isArray(o.concerns) || typeof o.nextStep !== "string") return null;
  const cs = o.concernSurfaced as Record<string, unknown> | undefined;
  if (!cs || typeof cs.status !== "string" || typeof cs.quote !== "string") return null;
  const keys = FEEDBACK_BEHAVIORS.map((b) => b.key) as string[];
  const observations = o.observations.flatMap((x) => {
    const r = x as Record<string, unknown>;
    if (typeof r.key !== "string" || !keys.includes(r.key)) return [];
    if (typeof r.status !== "string" || !(OBSERVATION_STATUSES as readonly string[]).includes(r.status)) return [];
    const quotes = Array.isArray(r.quotes) ? r.quotes.filter((q): q is string => typeof q === "string") : [];
    return [{ key: r.key as FeedbackBehaviorKey, status: r.status as ObservationStatus, quotes, note: typeof r.note === "string" ? r.note : "" }];
  });
  const concerns = o.concerns.flatMap((x) => {
    const r = x as Record<string, unknown>;
    if (typeof r.kind !== "string" || !(CONCERN_KINDS as readonly string[]).includes(r.kind)) return [];
    return [{ kind: r.kind as ConcernKind, quote: typeof r.quote === "string" ? r.quote : "", explanation: typeof r.explanation === "string" ? r.explanation : "" }];
  });
  if (!["yes", "partly", "no"].includes(cs.status)) return null;
  return { observations, concerns, concernSurfaced: { status: cs.status as "yes" | "partly" | "no", quote: cs.quote }, nextStep: o.nextStep };
}
