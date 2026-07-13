'use client';

import { useEffect, useState } from 'react';

interface Props {
  slug: string;
  displayName: string;
}

// Same localStorage key the DJ console reads — pairing lands the durable device
// token here, so the console is authorized on the very next screen.
const djKey = (slug: string) => `bty-dj-cred:${slug}`;

type Phase = 'confirm' | 'connecting' | 'error' | 'no-code';

export default function PairClient({ slug, displayName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);

  // Read the one-time token from the URL client-side (never rendered / logged).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (!t) {
      setPhase('no-code');
      return;
    }
    setToken(t);
  }, []);

  async function connect() {
    if (!token) return;
    setPhase('connecting');
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? 'This pairing code is no longer valid.');
        setPhase('error');
        return;
      }
      const data = await res.json();
      window.localStorage.setItem(djKey(slug), data.deviceToken);
      try {
        (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.([10, 40, 16]);
      } catch {
        /* best effort */
      }
      // Full navigation to the clean DJ URL — drops the token from the address
      // bar and lets the console pick up the new device session.
      window.location.replace(`/r/${encodeURIComponent(slug)}/dj`);
    } catch {
      setError('Network error. Try again.');
      setPhase('error');
    }
  }

  if (phase === 'no-code') {
    return (
      <div className="card hero glow">
        <div className="eyebrow cyan">Join as DJ</div>
        <div className="display-sm" style={{ marginTop: 6 }}>
          Scan the host’s QR
        </div>
        <p className="lead">
          Open the pairing QR on the host’s phone and scan it with this iPad’s camera to connect.
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="card hero glow">
        <div className="eyebrow cyan">Join as DJ</div>
        <div className="display-sm" style={{ marginTop: 6 }}>
          Pairing didn’t work
        </div>
        <div className="banner error" style={{ marginTop: 12 }}>
          {error}
        </div>
        <p className="lead">Ask the host to tap “Connect a DJ iPad” for a fresh code.</p>
      </div>
    );
  }

  return (
    <div className="card hero glow fade-up">
      <div className="eyebrow cyan">Join as DJ</div>
      <div className="display" style={{ margin: '6px 0' }}>
        {displayName}
      </div>
      <p className="lead">This iPad will control:</p>
      <ul className="stack" style={{ margin: '12px 0', paddingLeft: 18, color: 'var(--muted)' }}>
        <li>Song requests</li>
        <li>Queue order</li>
        <li>YouTube playback flow</li>
      </ul>
      <button
        className="primary lg block"
        style={{ marginTop: 6 }}
        disabled={phase === 'connecting'}
        onClick={connect}
      >
        {phase === 'connecting' ? 'Connecting…' : 'Connect this iPad'}
      </button>
    </div>
  );
}
