import {
  resolveSourceIdentity,
  type SourceIdentity,
  type SourceIdentityResult,
} from "@/domain/foundry/arena-draft/sourceCommitIdentity";

/**
 * THE ONE SERVER-SIDE SOURCE OF DEPLOYMENT IDENTITY (Slice 3.2I-R5B2-R5C-3V2).
 *
 * Exactly one environment variable is canonical:
 *
 *     BTY_SOURCE_COMMIT_SHA
 *
 * `BTY_DEPLOY_VERSION` is deliberately NOT consulted here. The staging deploy wrapper sets both to
 * the same SHA — the second only so the existing (dual-index tracked, unmodifiable) `/api/version`
 * route reports the real commit. But `BTY_DEPLOY_VERSION` also has a stale static value baked into
 * `wrangler.toml`, so a deployment made by any other path would leave it holding a release label.
 * If generation trusted it, the identity would be right only when someone remembered the ritual —
 * which is precisely the failure this slice removes.
 *
 * Identity comes from the process environment and NOWHERE else: never a request header, query
 * parameter, cookie or body. A client that could name the build could forge the provenance of every
 * attempt recorded under it.
 */

export const SOURCE_COMMIT_ENV = "BTY_SOURCE_COMMIT_SHA";

/** The full result, including why a value was refused. */
export function readSourceIdentity(env: NodeJS.ProcessEnv = process.env): SourceIdentityResult {
  return resolveSourceIdentity(env[SOURCE_COMMIT_ENV]);
}

/** The identity, or `null` when this build cannot name itself. */
export function currentSourceIdentity(env: NodeJS.ProcessEnv = process.env): SourceIdentity | null {
  const r = readSourceIdentity(env);
  return r.ok ? r.identity : null;
}
