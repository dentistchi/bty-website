'use client';

// BUILD 20B-R5 — production-safe path-attribution panel. Renders ABOVE the first
// search result ONLY when the URL carries `?btydiag=1`; the normal UI is unchanged
// when off. Its job is to prove, on the REAL failing device, which surface / host /
// build / component actually rendered a card and what the shared formatter produced.
//
// SURFACE is hard-coded WEB: this component only exists in the web app, so if this
// panel appears at all the device is running THIS web build — and if the device
// shows raw provider-first titles but this panel does NOT appear under ?btydiag=1,
// the failing surface is Native or a legacy client, not this build.
//
// It exposes ONLY already-public presentation data (raw/formatted title, channel,
// host, build id, component name) — never tokens, accounts, emails, cancelTokens,
// authorization headers, or request capabilities.

import { useEffect, useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { songDisplay } from '@/domain/song-title';

/** True when diagnostics are explicitly activated via `?btydiag=1`. */
export function isDiagActive(search: string): boolean {
  try {
    return new URLSearchParams(search).get('btydiag') === '1';
  } catch {
    return false;
  }
}

interface Props {
  /** The first search result actually being rendered (raw, unformatted). */
  sample: YoutubeSearchItem | null;
  /** The component that renders the result cards on this surface. */
  component?: string;
}

export default function GuestDiagnosticPanel({ sample, component = 'RequestResultCard' }: Props) {
  // Read the flag AFTER mount (avoids an SSR/CSR hydration mismatch on window).
  const [active, setActive] = useState(false);
  const [host, setHost] = useState('');
  useEffect(() => {
    setActive(isDiagActive(window.location.search));
    setHost(window.location.host);
  }, []);

  if (!active) return null;

  const build = process.env.NEXT_PUBLIC_KARAOKE_BUILD ?? 'unknown';
  const d = sample ? songDisplay(sample.title, sample.channelTitle) : null;
  const rows: Array<[string, string]> = [
    ['SURFACE', 'WEB'],
    ['HOST / ORIGIN', host || '(pending)'],
    ['BUILD', build],
    ['ROUTE / COMPONENT', component],
    ['RAW TITLE', sample ? sample.title : '(no result yet — run a search)'],
    ['RAW CHANNEL', sample ? sample.channelTitle : '—'],
    ['FORMATTED TITLE', d ? d.title : '—'],
    ['FORMATTED ARTIST', d ? (d.artist ?? 'nil') : '—'],
    ['SOURCE', d ? (d.sourceLabel ?? 'nil') : '—'],
  ];

  return (
    <div className="bty-diag" role="status" aria-label="BTY diagnostics" data-bty-diag data-bty-build={build}>
      <div className="bty-diag-head">BTY DIAG · path attribution</div>
      <dl className="bty-diag-grid">
        {rows.map(([k, v]) => (
          <div className="bty-diag-row" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
