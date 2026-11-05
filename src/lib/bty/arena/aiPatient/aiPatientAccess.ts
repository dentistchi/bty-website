/**
 * AI PATIENT — server-side access policy and per-user usage limits.
 *
 * ACCESS. Callers authenticate and check CURRENT consent before this policy runs.
 * `AI_PATIENT_ACCESS_MODE=all_consented` opens access to those users. Unset/empty or `allowlist`
 * retains the explicit `AI_PATIENT_ALLOWED_USER_IDS` policy; an empty allowlist admits nobody.
 * Unknown modes refuse everyone. Every route checks the same policy on every request.
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

export function isAiPatientAllowed(userId: string): boolean {
  const id = userId.trim().toLowerCase();
  if (!id) return false;
  const mode = (process.env.AI_PATIENT_ACCESS_MODE ?? "").trim();
  if (mode === "all_consented") return true;
  if (mode !== "" && mode !== "allowlist") return false;
  return aiPatientAllowedUserIds().has(id);
}

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
