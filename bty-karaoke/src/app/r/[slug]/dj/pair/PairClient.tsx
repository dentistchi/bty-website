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
      // V3.1 — the paired iPad's DEFAULT destination is the read-only Display
      // (the song board by the mic), NOT the DJ console. Normal operation runs on
      // each guest's phone; the device token stays in localStorage so an admin can
      // reach the exception console at /r/<slug>/dj when reorder/force-finish is
      // needed. Full navigation drops the token from the address bar.
      window.location.replace(`/r/${encodeURIComponent(slug)}/display`);
    } catch {
      setError('Network error. Try again.');
      setPhase('error');
    }
  }

  if (phase === 'no-code') {
    return (
      <div className="card hero glow">
        <div className="eyebrow cyan">Connect Display</div>
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
        <div className="eyebrow cyan">Connect Display</div>
        <div className="display-sm" style={{ marginTop: 6 }}>
          Pairing didn’t work
        </div>
        <div className="banner error" style={{ marginTop: 12 }}>
          {error}
        </div>
        <p className="lead">Ask the host to tap “Connect Display iPad” for a fresh code.</p>
      </div>
    );
  }

  return (
    <div className="card hero glow fade-up">
      <div className="eyebrow cyan">Connect Display</div>
      <div className="display" style={{ margin: '6px 0' }}>
        {displayName}
      </div>
      <p className="lead">This iPad becomes the room’s Display:</p>
      <ul className="stack" style={{ margin: '12px 0', paddingLeft: 18, color: 'var(--muted)' }}>
        <li>Guest QR to scan and join</li>
        <li>Now singing &amp; who’s next</li>
      </ul>
      <p className="muted" style={{ marginTop: 4 }}>
        Everyone runs their own song from their phone. Reorder and force-finish stay in Admin
        Controls when you need them.
      </p>
      <button
        className="primary lg block"
        style={{ marginTop: 6 }}
        disabled={phase === 'connecting'}
        onClick={connect}
      >
        {phase === 'connecting' ? 'Connecting…' : 'Open the Display'}
      </button>
    </div>
  );
}
