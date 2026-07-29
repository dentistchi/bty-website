// Pure decision logic for the guest client freshness guard — BUILD 20B-WEB7-R4.
//
// Problem: an iOS Safari tab opened BEFORE a deploy can be restored from the
// in-memory / back-forward cache (bfcache) and keep running the OLD JS bundle,
// showing pre-fix UI even though the live document (no-store) references the new
// chunks. There is no service worker. The guard compares the build baked into the
// RUNNING bundle against the build the SERVER currently reports, and reloads ONCE
// when they differ so the stale tab migrates without any manual cache clearing.
//
// This module is pure (no window/fetch) so the reload decision is unit-testable.

export interface FreshnessInput {
  /** Build id compiled into the running JS bundle (NEXT_PUBLIC_KARAOKE_BUILD). */
  running: string | null | undefined;
  /** Build id the live server currently reports for this route. */
  served: string | null | undefined;
  /**
   * The served build we have ALREADY reloaded for this session (loop guard). A
   * second mismatch to the same served build must not reload again — otherwise a
   * server that never matches (misconfig) would loop the guest forever.
   */
  reloadedFor?: string | null;
}

/**
 * Reload iff both build ids are known, they differ, and we have not already
 * reloaded for this exact served build this session. Unknown ids (missing env,
 * failed fetch) never trigger a reload — a blip must never bounce a guest.
 */
export function shouldReload({ running, served, reloadedFor }: FreshnessInput): boolean {
  if (!running || !served) return false;
  if (running === served) return false;
  if (reloadedFor && reloadedFor === served) return false;
  return true;
}

/** sessionStorage key recording the served build we last reloaded for (loop guard). */
export const FRESHNESS_RELOAD_KEY = 'bty-karaoke:freshness:reloaded-for';
