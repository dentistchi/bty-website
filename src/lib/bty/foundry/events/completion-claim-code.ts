import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
/*
  THIS MODULE IS SERVER ONLY — it imports `node:crypto`. The display grouping lives in a pure
  module so the three client terminals can format a code without dragging the generator and the
  hash into the browser bundle, which webpack correctly refuses.
*/
export { CLAIM_CODE_GROUP, formatClaimCodeForDisplay } from "@/domain/foundry/events/completionClaimFormat";

/**
 * DEFERRED COMPLETION CLAIM — the credential that lets a learner come back for their own
 * completion later, from anywhere.
 *
 * WHY A SECOND CREDENTIAL EXISTS AT ALL. `participant-session.ts` already mints a 256-bit opaque
 * token, stores only its SHA-256, and hands the raw value to exactly one browser. The
 * cryptography was never the problem — the TRANSPORT is: that token lives in an `HttpOnly`
 * cookie, capped at 30 days, scoped to one event on one device, and by design the learner can
 * never be shown it. Measured consequence: 30 of 45 completions carry no account, and no surface
 * anywhere in the app can attach them.
 *
 * SO THIS IS A DIFFERENT CREDENTIAL WITH A SMALLER POWER. The session token authenticates a
 * PARTICIPANT — whoever holds it re-enters the room as that person and reads their own answers.
 * A claim code proves exactly one thing, "I am the person who finished this", and can do nothing
 * else. Handing out the session token instead would have turned a claim artifact into a
 * private-content bearer token.
 *
 * ENTROPY, CALCULATED RATHER THAN ASSERTED. The alphabet is Crockford Base32 — 32 symbols, so
 * each symbol carries exactly 5 bits with no modulo bias to correct (32 divides 256). Twelve
 * symbols therefore carry 12 × 5 = **60 bits**, the floor this credential was specified at.
 * Against the endpoint's rate limit (10 attempts per minute per account) an attacker needs a
 * median 2^59 guesses ≈ 5.8e17, or on the order of 10^11 years. The limit is the second half of
 * that argument and is not optional.
 *
 * CROCKFORD, FOR PEOPLE READING THEIR OWN HANDWRITING. I, L and O are absent and normalise to 1,
 * 1 and 0; U is absent entirely (it is the checksum-only symbol in Crockford, and dropping it
 * also removes a common transcription accident). Input is upper-cased and stripped of anything
 * that is not a symbol, so hyphens, spaces and lowercase all work.
 *
 * ONLY THE HASH IS EVER STORED. The raw code is returned to the learner exactly once, in the
 * completion response, and never persisted, logged or serialised into an error.
 */

/** Crockford Base32 minus the checksum symbol: 32 symbols, exactly 5 bits each. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Symbols per code. 12 × log2(32) = 60 bits. */
export const CLAIM_CODE_SYMBOLS = 12;
/** Stated so a test can assert the arithmetic rather than trust the comment. */
export const CLAIM_CODE_ENTROPY_BITS = CLAIM_CODE_SYMBOLS * 5;
/** 90 days, single use — long enough for "I'll do it later", short enough that a written-down
 *  code is not a permanent bearer credential. */
export const CLAIM_CODE_TTL_DAYS = 90;

/**
 * A fresh code, unbiased. 32 is a power of two, so masking 5 bits off a random byte is uniform —
 * no rejection sampling and no `%` bias.
 */
export function generateClaimCode(): string {
  const bytes = randomBytes(CLAIM_CODE_SYMBOLS);
  let out = "";
  for (let i = 0; i < CLAIM_CODE_SYMBOLS; i++) out += ALPHABET[bytes[i] & 0x1f];
  return out;
}

/**
 * What a learner typed → the canonical secret, or null when it cannot be one.
 *
 * Accepts hyphens, spaces, lowercase and the three Crockford confusables. Returns null rather
 * than a padded guess when the length is wrong, so a short or long entry is refused before it
 * ever reaches a hash lookup.
 */
export function normalizeClaimCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/[^0-9A-Z]/g, "");
  if (cleaned.length !== CLAIM_CODE_SYMBOLS) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

/** The only form that reaches the database. */
export function hashClaimCode(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}



/** When a code minted now stops working. */
export function claimCodeExpiresAt(fromIso: string | Date = new Date()): string {
  const from = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  return new Date(from.getTime() + CLAIM_CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Constant-time hash comparison, for any caller that compares in application code rather than in
 * the database predicate. The redemption path compares inside a single SQL statement and does not
 * need this; it exists so that a future caller does not reach for `===` on a secret digest.
 */
export function claimHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
