'use client';

// Fires ONCE on the shared authenticated Host shell (Host Hub / Room Admin / native
// entry). It sends the browser's IANA timezone to the authenticated capture endpoint;
// the DB decides eligibility (only while source='default' + zero usage). A localStorage
// flag stops retries once the account is captured or no longer eligible, so this never
// polls and never fires while ineligible. Renders nothing.

import { useEffect } from 'react';

const DONE_KEY = 'bty-host-tz-captured';

export default function HostTimezoneCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(DONE_KEY)) return;
    } catch {
      /* private mode — fall through and try once */
    }
    let tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
      return;
    }
    if (!tz) return;

    void fetch('/api/host/timezone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ timezone: tz }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((j: { outcome?: string }) => {
        // Stop trying once captured OR permanently ineligible (already captured / usage started).
        if (j.outcome === 'ok' || j.outcome === 'already_captured' || j.outcome === 'locked_usage_started') {
          try {
            window.localStorage.setItem(DONE_KEY, '1');
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* best-effort; retried on the next authenticated load */
      });
  }, []);

  return null;
}
