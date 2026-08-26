/**
 * HOW A CLAIM CODE IS SHOWN — the half of the credential a browser is allowed to hold.
 *
 * `completion-claim-code.ts` mints and hashes, so it imports `node:crypto` and is SERVER ONLY.
 * The three room terminals are client components, and importing that module from them pulled
 * `node:crypto` into the browser bundle — webpack refused it, which is the correct answer: a
 * client has no business with the generator or the hash.
 *
 * So the display grouping lives here, pure and dependency-free, and both sides import it. This is
 * formatting, not cryptography: it adds separators for typing and nothing else, and
 * `normalizeClaimCode` strips them again on the way back.
 */

/** Displayed in groups of four; the separator is cosmetic and never part of the secret. */
export const CLAIM_CODE_GROUP = 4;

/** `XXXXXXXXXXXX` → `XXXX-XXXX-XXXX`. */
export function formatClaimCodeForDisplay(code: string): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += CLAIM_CODE_GROUP) groups.push(code.slice(i, i + CLAIM_CODE_GROUP));
  return groups.join("-");
}
