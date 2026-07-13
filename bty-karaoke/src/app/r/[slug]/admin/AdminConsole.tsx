'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DjDevice } from '@/lib/devices.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import { PRODUCT_NAME } from '@/lib/brand';
import { pairingSecondsRemaining, formatCountdown } from '@/domain/pairing';

interface Props {
  slug: string;
  displayName: string;
}

type Phase = 'loading' | 'need-auth' | 'authed';

// localStorage (NOT a cookie): the admin device token is never auto-attached to
// requests and never lands in page HTML. It travels only in an Authorization
// header on explicit admin calls, and is cleared on sign-out or 401.
const storageKey = (slug: string) => `bty-admin-cred:${slug}`;

type Pairing = { qrSvg: string; expiresAt: string; pairUrl: string };
type GuestQr = { qrSvg: string; url: string };

function vibrate(pattern: number | number[]) {
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern);
  } catch {
    /* best effort */
  }
}

export default function AdminConsole({ slug, displayName }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cred, setCred] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<KaraokeSession | null>(null);
  const [stats, setStats] = useState<{ requests: number; guests: number }>({ requests: 0, guests: 0 });
  const [devices, setDevices] = useState<DjDevice[]>([]);

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairedLabel, setPairedLabel] = useState<string | null>(null);
  const [guestQr, setGuestQr] = useState<GuestQr | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => 0);

  const authHeader = useCallback((c: string) => ({ authorization: `Bearer ${c}` }), []);

  const loadSession = useCallback(
    async (c: string): Promise<boolean> => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/session`, {
        headers: authHeader(c),
        cache: 'no-store',
      });
      if (res.status === 401) return false;
      if (!res.ok) throw new Error('session_failed');
      const data = await res.json();
      setSession(data.session ?? null);
      setStats(data.stats ?? { requests: 0, guests: 0 });
      return true;
    },
    [slug, authHeader],
  );

  const loadDevices = useCallback(
    async (c: string): Promise<DjDevice[]> => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/devices`, {
        headers: authHeader(c),
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      const list: DjDevice[] = data.devices ?? [];
      setDevices(list);
      return list;
    },
    [slug, authHeader],
  );

  const signOut = useCallback(() => {
    window.localStorage.removeItem(storageKey(slug));
    setCred(null);
    setSession(null);
    setDevices([]);
    setPairing(null);
    setGuestQr(null);
    setInput('');
    setPhase('need-auth');
  }, [slug]);

  // On mount: try a stored admin device token from this phone.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(slug)) : null;
    if (!saved) {
      setPhase('need-auth');
      return;
    }
    loadSession(saved)
      .then((ok) => {
        if (ok) {
          setCred(saved);
          setPhase('authed');
          void loadDevices(saved);
        } else {
          window.localStorage.removeItem(storageKey(slug));
          setPhase('need-auth');
        }
      })
      .catch(() => setPhase('need-auth'));
  }, [slug, loadSession, loadDevices]);

  // Ticking clock for the pairing countdown (only while a code is shown).
  useEffect(() => {
    if (!pairing) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pairing]);

  // First-time bootstrap: exchange the master credential for a durable admin
  // device token, then keep only the device token.
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const c = input.trim();
    if (!c) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/verify`, {
        method: 'POST',
        headers: authHeader(c),
      });
      if (res.status === 401) {
        setError('This admin code is not valid.');
        return;
      }
      if (!res.ok) {
        setError('Could not connect. Try again.');
        return;
      }
      const data = await res.json();
      const token: string = data.adminToken ?? c;
      window.localStorage.setItem(storageKey(slug), token);
      setCred(token);
      setInput('');
      await loadSession(token);
      await loadDevices(token);
      setPhase('authed');
      vibrate(12);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function adminCall(path: string, init?: RequestInit): Promise<Response | null> {
    if (!cred) return null;
    const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}${path}`, {
      ...init,
      headers: { ...authHeader(cred), ...(init?.headers ?? {}) },
    });
    if (res.status === 401) {
      signOut();
      return null;
    }
    return res;
  }

  async function startRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await adminCall('/admin/session', { method: 'POST' });
      if (res?.ok) {
        const data = await res.json();
        setSession(data.session ?? null);
        vibrate(12);
        if (cred) void loadDevices(cred);
      }
    } finally {
      setBusy(false);
    }
  }

  async function endRoom() {
    if (!window.confirm('End the karaoke night? New song requests will stop. History is kept.')) return;
    setBusy(true);
    try {
      const res = await adminCall('/admin/session', { method: 'DELETE' });
      if (res?.ok) setSession(null);
    } finally {
      setBusy(false);
    }
  }

  async function openPairing() {
    setBusy(true);
    setError(null);
    setPairedLabel(null);
    try {
      const res = await adminCall('/admin/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res?.ok) {
        const data = await res.json();
        setPairing({ qrSvg: data.qrSvg, expiresAt: data.expiresAt, pairUrl: data.pairUrl });
      }
    } finally {
      setBusy(false);
    }
  }

  function cancelPairing() {
    setPairing(null);
    setPairedLabel(null);
  }

  // While the pairing sheet is open, poll devices to detect the iPad connecting.
  useEffect(() => {
    if (!pairing || pairedLabel || !cred) return;
    const before = new Set(
      devices.filter((d) => d.role === 'dj' && d.status === 'active').map((d) => d.id),
    );
    const t = setInterval(async () => {
      const list = await loadDevices(cred);
      const fresh = list.find((d) => d.role === 'dj' && d.status === 'active' && !before.has(d.id));
      if (fresh) {
        setPairedLabel(fresh.label);
        vibrate([10, 40, 16]);
      }
    }, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing, pairedLabel, cred, loadDevices]);

  async function showGuestQr() {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setGuestQr({ qrSvg: data.qrSvg, url: data.url });
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, label: string) {
    if (!window.confirm(`Revoke "${label}"? That device will lose DJ access immediately.`)) return;
    const res = await adminCall(`/admin/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res?.ok && cred) void loadDevices(cred);
  }

  async function rotate() {
    if (!window.confirm('Rotate DJ access? Every paired DJ iPad must scan a new code to reconnect.')) return;
    setBusy(true);
    try {
      const res = await adminCall('/admin/rotate', { method: 'POST' });
      if (res?.ok && cred) void loadDevices(cred);
    } finally {
      setBusy(false);
    }
  }

  const brandHead = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">Admin</span>
    </div>
  );

  if (phase === 'loading') {
    return (
      <>
        {brandHead}
        <p className="lead">Opening the room…</p>
      </>
    );
  }

  if (phase === 'need-auth') {
    return (
      <>
        {brandHead}
        <div className="card hero glow">
          <div className="eyebrow">Host access</div>
          <div className="display-sm" style={{ marginTop: 6 }}>
            Unlock {displayName}
          </div>
          <p className="lead">Enter the host code once. This phone becomes the room controller.</p>
          <form onSubmit={connect} style={{ marginTop: 12 }}>
            {error && <div className="banner error">{error}</div>}
            <label htmlFor="admincode">Host code</label>
            <input
              id="admincode"
              type="password"
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Host code"
            />
            <button
              type="submit"
              className="primary lg block"
              style={{ marginTop: 14 }}
              disabled={busy || !input.trim()}
            >
              {busy ? 'Unlocking…' : 'Unlock room'}
            </button>
          </form>
        </div>
      </>
    );
  }

  const live = Boolean(session);

  return (
    <>
      {brandHead}

      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="eyebrow">Tonight’s Room</div>
        {live ? (
          <span className="pill live">
            <span className="live-dot" aria-hidden />
            LIVE
          </span>
        ) : (
          <span className="pill">Ready</span>
        )}
      </div>
      <div className="display">{displayName}</div>

      {!live ? (
        <div className="card hero glow fade-up">
          <p className="lead">The stage is set. Start the night and share the guest QR.</p>
          <button className="primary lg block" style={{ marginTop: 14 }} disabled={busy} onClick={startRoom}>
            {busy ? 'Starting…' : 'Start the room'}
          </button>
        </div>
      ) : (
        <>
          <div className="metric-row">
            <div className="metric">
              <div className="n">{stats.guests}</div>
              <div className="k">singers joined</div>
            </div>
            <div className="metric">
              <div className="n">{stats.requests}</div>
              <div className="k">songs in the room</div>
            </div>
          </div>

          <div className="stack" style={{ margin: '16px 0' }}>
            <button className="cyan lg block" disabled={busy} onClick={showGuestQr}>
              Show guest QR
            </button>
            <button className="primary lg block" disabled={busy} onClick={openPairing}>
              Connect a DJ iPad
            </button>
          </div>

          <div className="card glow">
            <div className="eyebrow muted">Paired devices</div>
            {devices.length === 0 ? (
              <p className="lead" style={{ marginTop: 8 }}>
                No devices yet. Tap “Connect a DJ iPad” to pair one.
              </p>
            ) : (
              devices.map((d) => (
                <div className={`device-row${d.status === 'revoked' ? ' revoked' : ''}`} key={d.id}>
                  <span
                    className={`status-dot ${d.status === 'active' ? 'ok' : ''}`}
                    aria-hidden
                  />
                  <div className="grow">
                    <div className="d-name">
                      {d.label}
                      {d.role === 'admin' ? ' · Admin' : ''}
                    </div>
                    <div className="d-meta">
                      {d.status === 'revoked' ? 'Revoked' : 'Connected'} · paired{' '}
                      {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {d.status === 'active' && d.role === 'dj' && (
                    <button className="danger" onClick={() => revoke(d.id, d.label)}>
                      Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="row between" style={{ marginTop: 18 }}>
            <button className="linkish" onClick={rotate}>
              Rotate DJ access
            </button>
            <button className="danger" disabled={busy} onClick={endRoom}>
              End karaoke night
            </button>
          </div>
        </>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
        <button className="linkish" onClick={signOut}>
          Sign out of this phone
        </button>
      </div>

      {/* DJ pairing sheet */}
      {pairing && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Connect a DJ">
          {pairedLabel ? (
            <div className="bloom">
              <span className="pill ok">✓ DJ CONNECTED</span>
              <div className="display-sm" style={{ margin: '14px 0' }}>
                {pairedLabel} is ready.
              </div>
              <button className="primary lg" onClick={cancelPairing}>
                Open room controls
              </button>
            </div>
          ) : (
            <div>
              <div className="eyebrow cyan">Connect a DJ</div>
              <div className="display-sm" style={{ margin: '6px 0 14px' }}>
                Scan this with the iPad
              </div>
              {(() => {
                const secs = pairingSecondsRemaining(pairing.expiresAt, nowMs || Date.now());
                if (secs <= 0) {
                  return (
                    <div className="card" style={{ maxWidth: 340, margin: '0 auto' }}>
                      <p className="lead">This code expired.</p>
                      <button className="primary block" disabled={busy} onClick={openPairing}>
                        New code
                      </button>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="qr-surface" dangerouslySetInnerHTML={{ __html: pairing.qrSvg }} />
                    <div className="qr-caption">
                      {displayName} · Expires in{' '}
                      <span className="countdown">{formatCountdown(secs)}</span>
                    </div>
                    <p className="muted">Only one device can use this code.</p>
                  </>
                );
              })()}
              <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button className="ghost" disabled={busy} onClick={openPairing}>
                  Refresh code
                </button>
                <button className="linkish" onClick={cancelPairing}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guest QR overlay */}
      {guestQr && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Guest QR">
          <div>
            <div className="eyebrow">Request a song</div>
            <div className="display-sm" style={{ margin: '6px 0 14px' }}>
              Scan to join {displayName}
            </div>
            <div className="qr-surface" dangerouslySetInnerHTML={{ __html: guestQr.qrSvg }} />
            <div className="qr-caption">{stats.guests} singers joined</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="ghost" onClick={() => setGuestQr(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
