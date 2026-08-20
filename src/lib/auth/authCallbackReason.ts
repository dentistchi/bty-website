/**
 * WHICH CALLBACK BRANCH FIRED (Slice R4-R4B-R1).
 *
 * `/[locale]/auth/callback` had three distinct failures rendering one identical sentence, so a
 * Founder report of "인증 처리에 실패했습니다" could not say which happened, and the audit could
 * only rank hypotheses. These codes exist so ONE failed sign-in names its own branch.
 *
 * They are deliberately a closed set of opaque slugs. Nothing derived from the request — no auth
 * code, token, user id, email or provider detail — may ever join them; the value is safe to put in
 * a URL, read aloud, or paste into a message, which is the entire point of having it.
 *
 * WHAT EACH ONE POINTS AT, because they are repaired in different places:
 *
 *   no_code             the callback arrived with no code, no token pair and no session already
 *                       in the client. Nothing was there to exchange — which is what a rejected
 *                       `redirect_to` looks like from our side, and points at configuration
 *                       rather than at our code.
 *   exchange_failed     a code WAS present and `exchangeCodeForSession` refused it. A PKCE,
 *                       expiry or single-use question — the round trip reached us.
 *   set_session_failed  a token pair was present and `setSession` refused it. A token-validity
 *                       question, not a redirect one.
 */
export const AUTH_CALLBACK_REASONS = ["no_code", "exchange_failed", "set_session_failed"] as const;

export type AuthCallbackReason = (typeof AUTH_CALLBACK_REASONS)[number];

/** Fail-closed: anything outside the closed set is not a reason we recognise. */
export function isAuthCallbackReason(v: unknown): v is AuthCallbackReason {
  return typeof v === "string" && (AUTH_CALLBACK_REASONS as readonly string[]).includes(v);
}

/**
 * The support line shown under the error. Intentionally NOT translated: it is a diagnostic token
 * for whoever reads the report, not product copy, and translating it would make two failures look
 * like different problems.
 */
export function authCallbackSupportLine(reason: AuthCallbackReason): string {
  return `Reference: ${reason}`;
}
