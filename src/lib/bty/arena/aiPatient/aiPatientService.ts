/**
 * AI PATIENT — conversation and feedback orchestration (service layer).
 *
 * Domain rules decide WHAT is allowed; this file performs the provider calls. The patient model only
 * ever sees the authored case, the hidden concern and the sealed transcript — never client-supplied
 * instructions — and a reply that steps out of the patient role is regenerated once, then refused.
 */

import { getLlmClient, type LlmChatMessage } from "@/lib/bty/llm/client";
import { aiPatientOpenAIKey } from "./providerKey";
import type { AiPatientCase, HiddenConcern } from "@/domain/arena/aiPatient/caseAcceptance01";
import { resolveCase, scenarioFor } from "@/domain/arena/aiPatient/scenarios";
import { DEFAULT_SCENARIO_ID, type AiPatientScenarioId } from "@/domain/arena/aiPatient/scenarioCatalog";
import {
  AI_PATIENT_LIMITS,
  breaksPatientRole,
  cleanPatientReply,
  learnerTurnCount,
  sessionPhase,
  type AiPatientSessionState,
} from "@/domain/arena/aiPatient/sessionRules";
import { buildPatientMessages, roleReminder } from "@/domain/arena/aiPatient/patientPrompt";
import { buildFeedbackMessages, FEEDBACK_JSON_SCHEMA, parseRawFeedback, reconcileFeedback, type ShownFeedback } from "@/domain/arena/aiPatient/feedback";
import { buildCoachingView, type CoachingView } from "@/domain/arena/aiPatient/coachingView";
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

export const isAiPatientAvailable = (): boolean => Boolean(aiPatientOpenAIKey());

/** Uniform random choice among the scenario's hidden concerns, made by the server before the first word. */
export function pickConcern(kase: AiPatientCase, random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32): HiddenConcern {
  const keys = Object.keys(kase.hiddenConcerns);
  return keys[Math.min(keys.length - 1, Math.floor(random() * keys.length))]!;
}

export function newSession(userId: string, now: number, scenarioId: AiPatientScenarioId = DEFAULT_SCENARIO_ID, concern?: HiddenConcern): AiPatientSessionState {
  const kase = scenarioFor(scenarioId);
  return {
    v: 1,
    sid: crypto.randomUUID(),
    uid: userId,
    caseId: kase.id,
    concern: concern ?? pickConcern(kase),
    startedAt: now,
    expiresAt: now + AI_PATIENT_LIMITS.sessionSeconds * 1000,
    turns: [{ role: "patient", text: kase.openingLine }],
  };
}

/** The case a live session runs on. Unseal already refused any session whose case is unknown. */
export function caseOf(state: Pick<AiPatientSessionState, "caseId">): AiPatientCase {
  const kase = resolveCase(state.caseId);
  if (!kase) throw new Error(`Unknown AI patient case: ${state.caseId}`);
  return kase;
}

async function patientReply(messages: LlmChatMessage[], patientName: string): Promise<string> {
  const res = await getLlmClient({ dedicatedOpenAiApiKey: aiPatientOpenAIKey() }).chat.completions.create(
    { model: AI_PATIENT_MODELS.patient, messages, temperature: 0.8, max_tokens: AI_PATIENT_LIMITS.patientMaxTokens },
    { signal: AbortSignal.timeout(PATIENT_TIMEOUT_MS) },
  );
  const choice = res.choices?.[0];
  if (!choice || choice.message.refusal) return "";
  return cleanPatientReply(choice.message.content ?? "", patientName);
}

export type TurnResult =
  | { ok: true; state: AiPatientSessionState; patientText: string }
  | { ok: false; reason: ServiceFailure };

/** One exchange: the learner's words in, the patient's answer out. The input state is never mutated. */
export async function takeTurn(state: AiPatientSessionState, learnerText: string, via: "voice" | "text", now: number): Promise<TurnResult> {
  if (sessionPhase(state, now) !== "active") return { ok: false, reason: "session_over" };
  if (!isAiPatientAvailable()) return { ok: false, reason: "llm_unavailable" };
  const turns = [...state.turns, { role: "tc" as const, text: learnerText, via }];
  const kase = caseOf(state);
  const messages = buildPatientMessages(state.concern, turns, kase);
  let reply: string;
  try {
    reply = await patientReply(messages, kase.patientName);
    if (!reply || breaksPatientRole(reply)) reply = await patientReply([...messages, roleReminder(kase)], kase.patientName);
  } catch {
    return { ok: false, reason: "provider_failed" };
  }
  if (!reply || breaksPatientRole(reply)) return { ok: false, reason: "patient_left_role" };
  return { ok: true, state: { ...state, turns: [...turns, { role: "patient", text: reply }] }, patientText: reply };
}

/** The reconciled review plus the coaching view built from it (Issue #69). */
export type CoachedFeedback = ShownFeedback & { coaching: CoachingView };

export type FeedbackResult = { ok: true; feedback: CoachedFeedback } | { ok: false; reason: ServiceFailure };

/** One strict-JSON model call. Any failure — transport, refusal, truncation, bad JSON — is `null`. */
async function strictJson(model: string, messages: LlmChatMessage[], name: string, schema: object, maxTokens: number): Promise<unknown | null> {
  try {
    const res = await getLlmClient({ dedicatedOpenAiApiKey: aiPatientOpenAIKey() }).chat.completions.create(
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
  if (!isAiPatientAvailable()) return { ok: false, reason: "llm_unavailable" };
  const kase = caseOf(state);
  const [coach, screenRaw] = await Promise.all([
    strictJson(AI_PATIENT_MODELS.feedback, buildFeedbackMessages(state.concern, state.turns, kase), "ai_patient_feedback", FEEDBACK_JSON_SCHEMA, 1600),
    strictJson(AI_PATIENT_MODELS.screen, buildSafetyScreenMessages(state.turns, kase), "ai_patient_safety_screen", SAFETY_SCREEN_JSON_SCHEMA, 800),
  ]);
  const raw = parseRawFeedback(coach);
  if (!raw) return { ok: false, reason: "feedback_unreadable" };
  const screen: ScreenFinding[] | null = screenRaw === null ? null : parseSafetyScreen(screenRaw, state.turns);
  const feedback = reconcileFeedback(raw, state.concern, state.turns, screen, kase);
  return { ok: true, feedback: { ...feedback, coaching: buildCoachingView(feedback, state.turns, kase.coaching) } };
}
