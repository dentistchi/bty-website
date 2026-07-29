'use client';

// Guest client freshness guard — BUILD 20B-WEB7-R4.
//
// Migrates a STALE guest tab (opened before a deploy, restored from iOS Safari's
// bfcache / suspended-tab memory) to the current build WITHOUT any manual cache
// clearing. The live guest document is already `no-store` and references the current
// hashed chunks, so a fresh network load is always correct — the only failure mode
// is an old tab that never re-fetched. On a bfcache restore (`pageshow.persisted`)
// or when a long-hidden tab becomes visible, this asks the server for its current
// build id and reloads ONCE if the running bundle is older. No service worker.

import { useEffect } from 'react';
import { shouldReload, FRESHNESS_RELOAD_KEY } from '@/domain/build-freshness';

export default function GuestFreshnessGuard() {
  // Baked into this JS bundle at build time (Next inlines NEXT_PUBLIC_* at every
  // reference) — the build the RUNNING client is on.
  const RUNNING_BUILD = process.env.NEXT_PUBLIC_KARAOKE_BUILD ?? null;

  useEffect(() => {
    let cancelled = false;

    async function checkFreshness() {
      if (!RUNNING_BUILD) return;
      let served: string | null = null;
      try {
        // Unique query defeats any Cloudflare EDGE cache (e.g. a pre-deploy 404 that
        // got cached) — `cache:'no-store'` only governs the browser cache, not the CDN.
        const res = await fetch(`/api/karaoke-build?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        served = ((await res.json()) as { build?: string }).build ?? null;
      } catch {
        return; // network blip — never bounce the guest
      }
      if (cancelled || !served) return;

      let reloadedFor: string | null = null;
      try {
        reloadedFor = window.sessionStorage.getItem(FRESHNESS_RELOAD_KEY);
      } catch {
        /* private mode — proceed without the loop guard */
      }
      if (!shouldReload({ running: RUNNING_BUILD, served, reloadedFor })) return;

      try {
        window.sessionStorage.setItem(FRESHNESS_RELOAD_KEY, served); // reload at most once per served build
      } catch {
        /* ignore */
      }
      // Reload from the network (bypasses the bfcache document) to pick up the new build.
      window.location.reload();
    }

    // A bfcache restore (Safari back/forward or reopened tab) runs the OLD bundle —
    // this is the primary stale path, so verify freshness on every persisted show.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void checkFreshness();
    };
    // A suspended tab that becomes visible again may not fire pageshow.persisted on
    // iOS — verify when the guest returns to the tab too.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkFreshness();
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [RUNNING_BUILD]);

  // Non-visual served-build proof on the DOM (fresh in every no-store document).
  return <span data-karaoke-build={RUNNING_BUILD ?? 'unknown'} hidden aria-hidden />;
}
