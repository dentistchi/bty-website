/**
 * IMMUTABLE SOURCE IDENTITY (Slice 3.2I-R5B2-R5C-3V2).
 *
 * R5C-2 made every provider call observable, and then R5C measured what the parent attempt still
 * could not say: WHICH BUILD ran it. The recorded value was `2026-04-27-api-version-endpoint-v1` —
 * a release label written into `wrangler.toml` months earlier. It cannot be traced to source, it
 * does not change when the code changes, and nothing detects that it has gone stale.
 *
 * A Git commit SHA has the one property a release label lacks: it is derived FROM the source, so it
 * cannot silently describe a build it did not come from.
 *
 * This module is the whole vocabulary. It is PURE — no environment, no process, no I/O — so the
 * rule "what counts as identity" is testable independently of how a value happens to arrive.
 */

/** Exactly 40 lowercase hex characters. Nothing shorter, nothing else. */
export const SOURCE_COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export type SourceIdentity = {
  sourceCommitSha: string;
  identityKind: "git_commit";
};

/**
 * UPPERCASE POLICY — measured and deliberate.
 *
 * `git rev-parse HEAD` emits lowercase, always. A value that arrives uppercase therefore did NOT
 * come from the one trusted producer, so it is REJECTED rather than normalized. Lower-casing it
 * here would mean accepting a value whose origin is unknown, and identity that accepts unknown
 * origins is not identity. There is no normalization path.
 */
export function isValidSourceCommitSha(value: unknown): value is string {
  return typeof value === "string" && SOURCE_COMMIT_SHA_PATTERN.test(value);
}

/**
 * Why a candidate is not source identity. The reasons are named rather than collapsed into
 * `false`, because "you gave me a release label" and "you gave me nothing" call for different
 * operator responses.
 */
export type SourceIdentityRejection =
  | "absent"
  | "not_a_string"
  | "blank"
  | "wrong_length"
  | "not_lowercase_hex";

export type SourceIdentityResult =
  | { ok: true; identity: SourceIdentity }
  | { ok: false; reason: SourceIdentityRejection };

/**
 * The ONLY way a value becomes identity.
 *
 * Deliberately has no fallback chain. The previous resolver tried four environment variables and a
 * hardcoded `"0.1.0"`, so it could never fail — it always produced *something*, and that something
 * was wrong for three months. Failing closed is the point: a build that cannot name itself must
 * say so.
 */
export function resolveSourceIdentity(candidate: unknown): SourceIdentityResult {
  if (candidate === undefined || candidate === null) return { ok: false, reason: "absent" };
  if (typeof candidate !== "string") return { ok: false, reason: "not_a_string" };
  // Not trimmed: a SHA with surrounding whitespace did not come from `git rev-parse`, and
  // silently repairing it would hide whatever mangled it.
  if (candidate.length === 0) return { ok: false, reason: "blank" };
  if (candidate.trim().length === 0) return { ok: false, reason: "blank" };
  if (candidate.length !== 40) return { ok: false, reason: "wrong_length" };
  if (!SOURCE_COMMIT_SHA_PATTERN.test(candidate)) return { ok: false, reason: "not_lowercase_hex" };
  return { ok: true, identity: { sourceCommitSha: candidate, identityKind: "git_commit" } };
}
