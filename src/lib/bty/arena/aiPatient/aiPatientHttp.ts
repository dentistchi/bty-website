/**
 * AI PATIENT — shared request plumbing for the four thin routes.
 *
 * Every route: authenticated learner with CURRENT consent (the same gate as published practices),
 * on the pilot allowlist, within their per-user budget for that action — then the sealed session
 * opened for THAT user. No route reads or writes a database row about the conversation itself.
 */

import { NextResponse } from "next/server";
import { requireConsentedArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { AI_PATIENT_LIMITS, turnsLeft, type AiPatientSessionState } from "@/domain/arena/aiPatient/sessionRules";
import { AiPatientConfigError, sealSession, unsealSession } from "./sessionSeal";
import { consumeAiPatientBudget, isAiPatientAllowed, type AiPatientAction } from "./aiPatientAccess";
import type { ServiceFailure } from "./aiPatientService";

export const noStore = { "Cache-Control": "no-store" } as const;

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

/**
 * The gate every AI patient route passes before doing anything paid: signed in with current consent,
 * on the pilot allowlist (server-side; the hidden door is only a convenience), then one unit of this
 * user's budget for `action`.
 */
export async function requireLearner(action: AiPatientAction): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const gate = await requireConsentedArenaAccess();
  if (!gate.ok) return gate;
  const userId = gate.access.userId;
  if (!isAiPatientAllowed(userId)) return { ok: false, response: jsonError("ai_patient_not_enabled", 403) };
  const budget = await consumeAiPatientBudget(userId, action);
  if (!budget.allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "rate_limited", retryAfterSeconds: budget.retryAfterSeconds }, { status: 429, headers: { ...noStore, "Retry-After": String(budget.retryAfterSeconds) } }),
    };
  }
  return { ok: true, userId };
}

export async function openSession(sealed: unknown, userId: string): Promise<{ ok: true; state: AiPatientSessionState } | { ok: false; response: NextResponse }> {
  try {
    const r = await unsealSession(sealed, userId);
    if (r.ok) return r;
    // Someone else's session is indistinguishable from a broken one to the caller.
    return { ok: false, response: jsonError("session_invalid", 400) };
  } catch (e) {
    if (e instanceof AiPatientConfigError) return { ok: false, response: jsonError("ai_patient_unconfigured", 503) };
    throw e;
  }
}

/** What the screen needs after every step. Everything here is already visible to the learner. */
export async function sessionView(state: AiPatientSessionState) {
  return {
    state: await sealSession(state),
    turns: state.turns.map((t) => ({ role: t.role, text: t.text })),
    expiresAt: state.expiresAt,
    /** The server's clock, so the screen's countdown is right even when the device clock is not. */
    serverNow: Date.now(),
    turnsLeft: turnsLeft(state),
    limits: { sessionSeconds: AI_PATIENT_LIMITS.sessionSeconds, maxLearnerTurns: AI_PATIENT_LIMITS.maxLearnerTurns, maxLearnerChars: AI_PATIENT_LIMITS.maxLearnerChars, maxAudioSeconds: AI_PATIENT_LIMITS.maxAudioSeconds },
  };
}

export function failureResponse(reason: ServiceFailure): NextResponse {
  switch (reason) {
    case "llm_unavailable":
      return jsonError(reason, 503);
    case "provider_failed":
    case "patient_left_role":
    case "feedback_unreadable":
      return jsonError(reason, 502);
    case "session_over":
    case "feedback_window_closed":
      return jsonError(reason, 410);
    case "nothing_to_review":
      return jsonError(reason, 422);
  }
}
