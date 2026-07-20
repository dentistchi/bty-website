// Pure validation of an Apple identity token's CLAIMS (Host Account V1). No I/O:
// the server fetches Apple's public keys and verifies the RS256 signature, then
// hands the decoded claims here. Keeping the rule set pure makes every rejection
// path exhaustively testable without a network or a live Apple token.
//
// This module NEVER decides trust on its own — a caller that skips the signature
// check and calls only this function has proved nothing. Signature verification
// happens first, in apple-auth.server.ts; this is the second half of the gate.

/** The subset of Apple's identity-token claims we rely on. */
export interface AppleIdentityClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  sub?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
}

export const APPLE_ISSUER = 'https://appleid.apple.com';

/** Tolerated clock skew between Apple and the Worker. */
export const CLOCK_SKEW_SECONDS = 60;

export type AppleClaimsDecision =
  | { ok: true; subject: string; email: string | null }
  | { ok: false; code: string; error: string };

export interface ValidateArgs {
  claims: AppleIdentityClaims;
  /** The app's bundle id — the audience Apple issued the token for. */
  expectedAudience: string;
  /**
   * SHA-256 hex of the raw nonce the device generated, or null when the client
   * did not use a nonce. When provided, the token's `nonce` claim MUST match:
   * this is what stops a token captured from one sign-in being replayed.
   */
  expectedNonceHash: string | null;
  nowSeconds: number;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Validate Apple's claims. Order matters: issuer and audience are checked before
 * anything is trusted, expiry before the subject is used, and the nonce last so a
 * structurally valid but replayed token still fails.
 *
 *  - `iss` MUST be exactly https://appleid.apple.com
 *  - `aud` MUST be exactly this app's bundle id (a token minted for a DIFFERENT
 *    client is otherwise perfectly valid and would be accepted — this is the
 *    check that stops audience confusion)
 *  - `exp` MUST be in the future (small skew allowed)
 *  - `iat` MUST NOT be meaningfully in the future
 *  - `sub` MUST be present — it is the ONLY stable identifier; email is not
 *    (Apple relays it, users can hide or change it) and is never authorization
 *  - `nonce` MUST equal sha256(rawNonce) when a nonce was used
 */
export function validateAppleClaims(args: ValidateArgs): AppleClaimsDecision {
  const { claims, expectedAudience, expectedNonceHash, nowSeconds } = args;

  const iss = asString(claims.iss);
  if (iss !== APPLE_ISSUER) {
    return { ok: false, code: 'BAD_ISSUER', error: 'Identity token issuer is not Apple' };
  }

  // `aud` is a string for native sign-in. Reject anything else rather than
  // guessing — an array/absent audience must never silently pass.
  const aud = asString(claims.aud);
  if (!aud || aud !== expectedAudience) {
    return { ok: false, code: 'BAD_AUDIENCE', error: 'Identity token was not issued for this app' };
  }

  const exp = asNumber(claims.exp);
  if (exp === null || exp + CLOCK_SKEW_SECONDS <= nowSeconds) {
    return { ok: false, code: 'EXPIRED', error: 'Identity token has expired' };
  }

  const iat = asNumber(claims.iat);
  if (iat !== null && iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    return { ok: false, code: 'BAD_ISSUED_AT', error: 'Identity token is not yet valid' };
  }

  const sub = asString(claims.sub);
  if (!sub) {
    return { ok: false, code: 'NO_SUBJECT', error: 'Identity token has no subject' };
  }

  if (expectedNonceHash !== null) {
    const nonce = asString(claims.nonce);
    if (!nonce || nonce !== expectedNonceHash) {
      return { ok: false, code: 'BAD_NONCE', error: 'Identity token nonce does not match' };
    }
  }

  return { ok: true, subject: sub, email: asString(claims.email) };
}
