"use client";

import * as React from "react";

/**
 * Client-side FORCED_RESET sub-mode signal (Stage 2 step 4 sub-phase 2C-2;
 * v1.1.1 §5.5.2 + §8-7 HARD LOCKED nav enforcement). Mirrors the server
 * authority used by `userHasForcedResetPending` in `state-service.ts:userHasForcedResetPending`
 * (the 2C-1 middleware helper). Source: `GET /api/arena/leadership-engine/state` →
 * `forcedResetTriggeredAt != null`.
 *
 * Loading/error default: **NOT suppressed** (returns `false`). Rationale:
 * false-suppression on a normal user is a worse UX bug than a brief nav-visible
 * window for a forced-reset user — and middleware (2C-1) already redirects the
 * URL-level access. Open-on-failure parity with the server helper.
 *
 * Dedup: module-level in-flight promise + 60s TTL cache so multiple nav
 * components on the same page share one fetch.
 */
type CacheEntry = { value: boolean; fetchedAt: number };
const CACHE_TTL_MS = 60_000;
let inFlight: Promise<boolean> | null = null;
let cached: CacheEntry | null = null;

async function fetchForcedReset(): Promise<boolean> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const r = await fetch("/api/arena/leadership-engine/state", {
        credentials: "include",
      });
      if (!r.ok) {
        cached = { value: false, fetchedAt: Date.now() };
        return false;
      }
      const data = (await r.json()) as { forcedResetTriggeredAt?: string | null };
      const value = data?.forcedResetTriggeredAt != null;
      cached = { value, fetchedAt: Date.now() };
      return value;
    } catch {
      cached = { value: false, fetchedAt: Date.now() };
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Test-only — clears the module cache so unit tests don't leak between runs. */
export function __resetForcedResetActiveCacheForTests(): void {
  cached = null;
  inFlight = null;
}

export function useForcedResetActive(): boolean {
  const [active, setActive] = React.useState<boolean>(() => cached?.value === true);
  React.useEffect(() => {
    let cancelled = false;
    void fetchForcedReset().then((value) => {
      if (!cancelled) setActive(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return active;
}
