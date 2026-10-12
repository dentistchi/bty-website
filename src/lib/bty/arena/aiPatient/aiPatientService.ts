/**
 * AI PATIENT — conversation and feedback orchestration (service layer).
 *
 * Domain rules decide WHAT is allowed; this file performs the provider calls. The patient model only
 * ever sees the authored case, the hidden concern and the sealed transcript — never client-supplied
 * instructions — and a reply that steps out of the patient role is regenerated once, then refused.
 */

import { getLlmClient, isLlmAvailable, type LlmChatMessage } from "@/lib/bty/llm/client";
import { AI_PATIENT_CASE_ID, CASE_ACCEPTANCE_01, HIDDEN_CONCERNS, type HiddenConcern } from "@/domain/arena/aiPatient/caseAcceptance01";
import {
  AI_PATIENT_LIMITS,
  breaksPatientRole,
  cleanPatientReply,
  learnerTurnCount,
  sessionPhase,
  type AiPatientSessionState,
} from "@/domain/arena/aiPatient/sessionRules";
import { buildPatientMessages, ROLE_REMINDER } from "@/domain/arena/aiPatient/patientPrompt";
import { buildFeedbackMessages, FEEDBACK_JSON_SCHEMA, parseRawFeedback, reconcileFeedback, type ShownFeedback } from "@/domain/arena/aiPatient/feedback";
import { buildSafetyScreenMessages, parseSafetyScreen, SAFETY_SCREEN_JSON_SCHEMA, type ScreenFinding } from "@/domain/arena/aiPatient/safetyScreen";

export const AI_PATIENT_MODELS = {
  patient: process.env.AI_PATIENT_MODEL ?? "gpt-4.1-mini",
  // Feedback and the safety screen run once per session, so they use the stronger model: the first
  // live run showed the small model missing a clinical misrepresentation outright.
  feedback: process.env.AI_PATIENT_FEEDBACK_MODEL ?? "gpt-4.1",
  screen: process.env.AI_PATIENT_SCREEN_MODEL ?? "gpt-4.1",
};

const PATIENT_TIMEOUT_MS = 25_000;
const FEEDBACK_TIMEOUT_MS = 45_000;

export type ServiceFailure =
  | "llm_unavailable"
  | "provider_failed"
  | "patient_left_role"
  | "session_over"
  | "feedback_window_closed"
  | "nothing_to_review"
  | "feedback_unreadable";

export const isAiPatientAvailable = (): boolean => isLlmAvailable();

/** Uniform random choice of the hidden concern, made by the server before the first word. */
export function pickConcern(random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32): HiddenConcern {
  return HIDDEN_CONCERNS[Math.min(HIDDEN_CONCERNS.length - 1, Math.floor(random() * HIDDEN_CONCERNS.length))]!;
}

export function newSession(userId: string, now: number, concern: HiddenConcern = pickConcern()): AiPatientSessionState {
  return {
    v: 1,
    sid: crypto.randomUUID(),
    uid: userId,
    caseId: AI_PATIENT_CASE_ID,
    concern,
    startedAt: now,
    expiresAt: now + AI_PATIENT_LIMITS.sessionSeconds * 1000,
    turns: [{ role: "patient", text: CASE_ACCEPTANCE_01.openingLine }],
  };
}

async function patientReply(messages: LlmChatMessage[]): Promise<string> {
  const res = await getLlmClient().chat.completions.create(
    { model: AI_PATIENT_MODELS.patient, messages, temperature: 0.8, max_tokens: AI_PATIENT_LIMITS.patientMaxTokens },
    { signal: AbortSignal.timeout(PATIENT_TIMEOUT_MS) },
  );
  const choice = res.choices?.[0];
  if (!choice || choice.message.refusal) return "";
  return cleanPatientReply(choice.message.content ?? "");
}

export type TurnResult =
  | { ok: true; state: AiPatientSessionState; patientText: string }
  | { ok: false; reason: ServiceFailure };

/** One exchange: the learner's words in, the patient's answer out. The input state is never mutated. */
export async function takeTurn(state: AiPatientSessionState, learnerText: string, via: "voice" | "text", now: number): Promise<TurnResult> {
  if (sessionPhase(state, now) !== "active") return { ok: false, reason: "session_over" };
  if (!isLlmAvailable()) return { ok: false, reason: "llm_unavailable" };
  const turns = [...state.turns, { role: "tc" as const, text: learnerText, via }];
  const messages = buildPatientMessages(state.concern, turns);
  let reply: string;
  try {
    reply = await patientReply(messages);
    if (!reply || breaksPatientRole(reply)) reply = await patientReply([...messages, ROLE_REMINDER]);
  } catch {
    return { ok: false, reason: "provider_failed" };
  }
  if (!reply || breaksPatientRole(reply)) return { ok: false, reason: "patient_left_role" };
  return { ok: true, state: { ...state, turns: [...turns, { role: "patient", text: reply }] }, patientText: reply };
}

export type FeedbackResult = { ok: true; feedback: ShownFeedback } | { ok: false; reason: ServiceFailure };

/** One strict-JSON model call. Any failure — transport, refusal, truncation, bad JSON — is `null`. */
async function strictJson(model: string, messages: LlmChatMessage[], name: string, schema: object, maxTokens: number): Promise<unknown | null> {
  try {
    const res = await getLlmClient().chat.completions.create(
      { model, messages, temperature: 0.1, max_tokens: maxTokens, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } },
      { signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS) },
    );
    const choice = res.choices?.[0];
    if (!choice || choice.message.refusal || choice.finish_reason === "length") return null;
    return JSON.parse(choice.message.content ?? "");
  } catch {
    return null;
  }
}

/**
 * Coaching feedback plus the separate safety screen, in parallel. The coaching review is required;
 * the screen is reported honestly as unavailable if it fails, never silently skipped.
 */
export async function reviewSession(state: AiPatientSessionState, now: number): Promise<FeedbackResult> {
  if (sessionPhase(state, now) === "feedback_window_closed") return { ok: false, reason: "feedback_window_closed" };
  if (learnerTurnCount(state) === 0) return { ok: false, reason: "nothing_to_review" };
  if (!isLlmAvailable()) return { ok: false, reason: "llm_unavailable" };
  const [coach, screenRaw] = await Promise.all([
    strictJson(AI_PATIENT_MODELS.feedback, buildFeedbackMessages(state.concern, state.turns), "ai_patient_feedback", FEEDBACK_JSON_SCHEMA, 1600),
    strictJson(AI_PATIENT_MODELS.screen, buildSafetyScreenMessages(state.turns), "ai_patient_safety_screen", SAFETY_SCREEN_JSON_SCHEMA, 800),
  ]);
  const raw = parseRawFeedback(coach);
  if (!raw) return { ok: false, reason: "feedback_unreadable" };
  const screen: ScreenFinding[] | null = screenRaw === null ? null : parseSafetyScreen(screenRaw, state.turns);
  return { ok: true, feedback: reconcileFeedback(raw, state.concern, state.turns, screen) };
}
