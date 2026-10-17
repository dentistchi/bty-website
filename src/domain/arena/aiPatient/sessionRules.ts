/**
 * AI PATIENT — session rules (pure).
 *
 * Every limit that bounds a session's time, length and cost lives here, so the server enforces exactly
 * what the screen shows. Nothing here performs I/O.
 */

import type { HiddenConcern } from "./caseAcceptance01";

export const AI_PATIENT_LIMITS = {
  /** The practice conversation itself. */
  sessionSeconds: 300,
  /** After the conversation ends, feedback can still be requested for this long. */
  feedbackGraceSeconds: 900,
  /** Learner turns per session. */
  maxLearnerTurns: 14,
  /** Characters per learner turn, typed or transcribed. */
  maxLearnerChars: 600,
  /** One recorded clip. The client stops recording before this. */
  maxAudioBytes: 4_000_000,
  maxAudioSeconds: 45,
  /** Patient reply budget — a short spoken answer, never a monologue. */
  patientMaxTokens: 220,
} as const;

export type TurnRole = "tc" | "patient";
export type Turn = { role: TurnRole; text: string; via?: "voice" | "text" };

/** The whole session. It is sealed by the server and never trusted from the client in plain form. */
export type AiPatientSessionState = {
  v: 1;
  sid: string;
  uid: string;
  caseId: string;
  concern: HiddenConcern;
  startedAt: number;
  expiresAt: number;
  turns: Turn[];
};

export const learnerTurnCount = (s: Pick<AiPatientSessionState, "turns">): number => s.turns.filter((t) => t.role === "tc").length;

export const turnsLeft = (s: Pick<AiPatientSessionState, "turns">): number =>
  Math.max(0, AI_PATIENT_LIMITS.maxLearnerTurns - learnerTurnCount(s));

export type SessionPhase = "active" | "turns_exhausted" | "time_up" | "feedback_window_closed";

/** Where a session stands at `now`. The conversation ends on time OR turns; feedback outlives it. */
export function sessionPhase(s: AiPatientSessionState, now: number): SessionPhase {
  if (now > s.expiresAt + AI_PATIENT_LIMITS.feedbackGraceSeconds * 1000) return "feedback_window_closed";
  if (now > s.expiresAt) return "time_up";
  if (turnsLeft(s) === 0) return "turns_exhausted";
  return "active";
}

/**
 * Normalize one learner utterance. Returns null for nothing to say; refuses (never trims) an
 * over-long turn so the learner is told rather than silently cut off.
 */
export function cleanLearnerText(raw: unknown): { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" } {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  const text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > AI_PATIENT_LIMITS.maxLearnerChars) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

/**
 * Signs that a reply stepped OUT of the patient role: admitting to being an AI, naming the exercise,
 * or coaching/grading the learner. A reply that matches is regenerated once and otherwise refused —
 * it is never shown as the patient's words.
 */
const ROLE_BREAK_PATTERNS: RegExp[] = [
  /\bas an ai\b/i,
  /\b(?:i am|i'm) (?:an? )?(?:ai|artificial intelligence|assistant|chatbot|bot|language model)\b/i,
  /\blanguage model\b/i,
  /\brole[- ]?play\b/i,
  /\bsimulat(?:ion|ed)\b/i,
  /\b(?:great|good|nice) (?:job|work)\b/i,
  /\bwell done\b/i,
  /\byou should have\b/i,
  /\b(?:feedback|coaching) (?:for|on) you\b/i,
  /\btreatment coordinator(?:s)? should\b/i,
];

export const breaksPatientRole = (reply: string): boolean => ROLE_BREAK_PATTERNS.some((re) => re.test(reply));

/** Strip what a spoken patient line should never carry: stage directions, labels, quotes, markup. */
export function cleanPatientReply(raw: string, patientName = "Dana"): string {
  const label = new RegExp(`^\\s*(?:${patientName.replace(/[^A-Za-z]/g, "")}|dana|patient)\\s*:\\s*`, "i");
  return raw
    .replace(label, "")
    .replace(/\*[^*]{0,80}\*/g, " ")
    .replace(/\[[^\]]{0,80}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“]+|["”]+$/g, "")
    .trim();
}
