/**
 * AI PATIENT — who may use it, and how much (pilot controls).
 *
 * ACCESS. V1 is a Founder-only pilot. Access is an explicit allowlist of BTY user ids in
 * `AI_PATIENT_ALLOWED_USER_IDS` (comma-separated), checked on EVERY route. Unset or empty means
 * nobody: the feature is closed by default and opening it is a deliberate configuration change.
 *
 * COST. The session is sealed, not stored, so an old session can be sent again until it expires.
 * Rather than a session store, every paid call is counted PER USER in the existing KV limiter, so the
 * total a user can spend is bounded no matter how sessions are replayed. In deployed environments the
 * limiter fails closed if its KV binding is missing. KV counting is approximate (eventually
 * consistent), so these are ceilings with some slack, not exact meters.
 */

import { rateLimitKV } from "@/lib/rate-limit";

export function aiPatientAllowedUserIds(): Set<string> {
  return new Set(
    (process.env.AI_PATIENT_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isAiPatientAllowed = (userId: string): boolean => aiPatientAllowedUserIds().has(userId.trim().toLowerCase());

export type AiPatientAction = "start" | "turn" | "speech" | "feedback";

/**
 * Per-user ceilings. A full session is 1 start + at most 14 turns (+ a few resends) + ~15 patient
 * lines spoken + 1 feedback; the short windows allow that with room for retries, and the daily caps
 * bound everything else.
 */
export const AI_PATIENT_RATE_LIMITS: Record<AiPatientAction, Array<{ limit: number; windowSeconds: number }>> = {
  start: [
    { limit: 6, windowSeconds: 3600 },
    { limit: 20, windowSeconds: 86_400 },
  ],
  turn: [
    { limit: 30, windowSeconds: 600 },
    { limit: 200, windowSeconds: 86_400 },
  ],
  speech: [
    { limit: 45, windowSeconds: 600 },
    { limit: 250, windowSeconds: 86_400 },
  ],
  feedback: [
    { limit: 6, windowSeconds: 3600 },
    { limit: 20, windowSeconds: 86_400 },
  ],
};

/** Consume one unit of `action` for `userId` against every window. Refused if any window is full. */
export async function consumeAiPatientBudget(
  userId: string,
  action: AiPatientAction,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  for (const w of AI_PATIENT_RATE_LIMITS[action]) {
    const r = await rateLimitKV({ endpoint: `ai-patient:${action}:${w.windowSeconds}`, identifier: userId, limit: w.limit, windowSeconds: w.windowSeconds });
    if (!r.allowed) return r;
  }
  return { allowed: true };
}
