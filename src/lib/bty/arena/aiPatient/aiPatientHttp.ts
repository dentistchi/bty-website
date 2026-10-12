/**
 * AI PATIENT — shared request plumbing for the four thin routes.
 *
 * Every route: authenticated learner with CURRENT consent (the same gate as published practices),
 * then the sealed session opened for THAT user. No route reads or writes a database row about the
 * conversation itself.
 */

import { NextResponse } from "next/server";
import { requireConsentedArenaAccess } from "@/lib/bty/foundry/arena/arenaPracticeGate";
import { AI_PATIENT_LIMITS, turnsLeft, type AiPatientSessionState } from "@/domain/arena/aiPatient/sessionRules";
import { AiPatientConfigError, sealSession, unsealSession } from "./sessionSeal";
import type { ServiceFailure } from "./aiPatientService";

export const noStore = { "Cache-Control": "no-store" } as const;

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function requireLearner(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const gate = await requireConsentedArenaAccess();
  if (!gate.ok) return gate;
  return { ok: true, userId: gate.access.userId };
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
