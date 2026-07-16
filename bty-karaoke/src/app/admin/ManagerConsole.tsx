'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRODUCT_NAME } from '@/lib/brand';
import { pairingSecondsRemaining, formatCountdown } from '@/domain/pairing';
import type { EventStats } from '@/domain/event-stats';

// The manager session is an HttpOnly cookie set by the server — it is NEVER
// readable by this component and NEVER stored in localStorage. Same-origin fetches
// carry it automatically; a 401 means "not signed in" → show the passcode form.
interface EventView {
  id: string;
  name: string;
  hostName: string | null;
  status: 'draft' | 'active' | 'ended' | 'archived';
  publicCode: string;
  guestSlug: string;
  startsAt: string | null;
  endedAt: string | null;
  createdAt: string;
}
interface DjConnection {
  connected: boolean;
  label: string | null;
  lastUsedAt: string | null;
}
interface Summary {
  event: EventView;
  stats: EventStats;
  dj: DjConnection;
}
interface CreatedEvent {
  event: EventView;
  guestUrl: string;
  guestQrSvg: string;
  djEnrollmentUrl: string;
  djEnrollmentQrSvg: string;
  djEnrollmentExpiresAt: string;
}
interface DetailView {
  event: EventView;
  stats: EventStats;
  dj: DjConnection;
  guestUrl: string;
  guestQrSvg: string;
}

type Phase = 'loading' | 'need-login' | 'ready';
type View = 'list' | 'create' | 'success';

type QrModal =
  | { kind: 'guest'; svg: string; url: string; title: string }
  | { kind: 'dj'; svg: string; url: string; expiresAt: string; title: string }
  | null;

function djRoomSlug(publicCode: string): string {
  return `evt-${publicCode.toLowerCase()}`;
}

export default function ManagerConsole() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('list');
  const [events, setEvents] = useState<Summary[]>([]);
  const [created, setCreated] = useState<CreatedEvent | null>(null);
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [qr, setQr] = useState<QrModal>(null);
  const [nowMs, setNowMs] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [host, setHost] = useState('');

  const loadList = useCallback(async (): Promise<'ok' | 'unauth' | 'err'> => {
    try {
      const res = await fetch('/api/admin/events', { cache: 'no-store', credentials: 'same-origin' });
      if (res.status === 401) return 'unauth';
      if (!res.ok) return 'err';
      const data = await res.json();
      setEvents(data.events ?? []);
      return 'ok';
    } catch {
      return 'err';
    }
  }, []);

  useEffect(() => {
    (async () => {
      const r = await loadList();
      setPhase(r === 'ok' ? 'ready' : 'need-login');
    })();
  }, [loadList]);

  // Ticking clock only while a DJ QR (with a countdown) is open.
  useEffect(() => {
    if (qr?.kind !== 'dj') return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qr]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = passcode.trim();
    if (!p) return;
    setBusy(true);
    try {
      const res = await fetch('/api/manager/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ passcode: p }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('That passcode is not valid.');
        return;
      }
      setPasscode('');
      await loadList();
      setPhase('ready');
      setView('list');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function managerCall(path: string, init?: RequestInit): Promise<Response | null> {
    const res = await fetch(path, { ...init, credentials: 'same-origin' });
    if (res.status === 401) {
      setPhase('need-login');
      return null;
    }
    return res;
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await managerCall('/api/admin/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), hostName: host.trim() || undefined, startNow: true }),
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Could not create the event.');
        return;
      }
      setCreated(data as CreatedEvent);
      setName('');
      setHost('');
      setView('success');
      void loadList();
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    setError(null);
    setConfirmEnd(false);
    const res = await managerCall(`/api/admin/events/${encodeURIComponent(id)}`);
    if (!res) return;
    if (res.ok) {
      setDetail((await res.json()) as DetailView);
    }
  }

  function closeDetail() {
    setDetail(null);
    setConfirmEnd(false);
  }

  // Confirmed via the inline End Event confirmation in the detail sheet (never a
  // browser alert). Ends the event server-side; the detail then re-loads to show
  // the ended state, and the list reflects it. Does NOT touch DJ disconnect.
  async function endEvent(id: string) {
    setBusy(true);
    try {
      const res = await managerCall(`/api/admin/events/${encodeURIComponent(id)}/end`, { method: 'POST' });
      if (!res) return;
      if (res.ok) {
        setConfirmEnd(false);
        await openDetail(id); // re-render detail in its ended state (read-only)
        void loadList();
      }
    } finally {
      setBusy(false);
    }
  }

  async function showDjQr(id: string, name: string) {
    setBusy(true);
    try {
      const res = await managerCall(`/api/admin/events/${encodeURIComponent(id)}/dj-enrollment`, {
        method: 'POST',
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setQr({ kind: 'dj', svg: data.djEnrollmentQrSvg, url: data.djEnrollmentUrl, expiresAt: data.expiresAt, title: name });
      } else {
        setError(data?.error ?? 'Could not create the DJ QR.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the URL is shown under the QR as a fallback */
    }
  }

  async function shareLink(url: string, name: string) {
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; url?: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: name, url });
      else await copyLink(url);
    } catch {
      /* user dismissed the share sheet */
    }
  }

  async function signOut() {
    try {
      await fetch('/api/manager/session', { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      /* clearing the cookie is best-effort; the session still expires server-side */
    }
    setEvents([]);
    setView('list');
    setPhase('need-login');
  }

  const brandHead = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">Events</span>
    </div>
  );

  // ---- Render -------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <>
        {brandHead}
        <p className="lead">Loading events…</p>
      </>
    );
  }

  if (phase === 'need-login') {
    return (
      <>
        {brandHead}
        <div className="card hero glow">
          <div className="eyebrow">Manager</div>
          <div className="display-sm" style={{ marginTop: 6 }}>
            Tonight’s Events
          </div>
          <p className="lead">Enter the manager passcode to create and run events.</p>
          <form onSubmit={login} style={{ marginTop: 12 }}>
            {error && <div className="banner error">{error}</div>}
            <label htmlFor="passcode">Manager passcode</label>
            <input
              id="passcode"
              type="password"
              autoComplete="off"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
            />
            <button type="submit" className="primary lg block" style={{ marginTop: 14 }} disabled={busy || !passcode.trim()}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      {brandHead}

      {view === 'list' && (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="display-sm">Tonight’s Events</div>
            <button className="primary" onClick={() => { setError(null); setView('create'); }}>
              + New Event
            </button>
          </div>

          {events.length === 0 ? (
            <div className="card hero">
              <p className="lead">No events yet. Tap “+ New Event” to create your first one.</p>
            </div>
          ) : (
            <div className="stack">
              {events.map((s) => (
                <button key={s.event.id} className="event-row" onClick={() => openDetail(s.event.id)}>
                  <div className="row between">
                    <strong className="d-name">{s.event.name}</strong>
                    <span className={`pill ${s.event.status === 'active' ? 'live' : ''}`}>
                      {s.event.status === 'active' ? (
                        <>
                          <span className="live-dot" aria-hidden /> Active
                        </>
                      ) : (
                        s.event.status === 'ended' ? 'Ended' : s.event.status
                      )}
                    </span>
                  </div>
                  <div className="d-meta">
                    {s.stats.uniqueGuests} {s.stats.uniqueGuests === 1 ? 'guest' : 'guests'} ·{' '}
                    {s.stats.totalRequests} {s.stats.totalRequests === 1 ? 'song' : 'songs'}
                    {s.dj.connected ? ' · DJ connected' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <button className="linkish" onClick={signOut}>
              Sign out
            </button>
          </div>
        </>
      )}

      {view === 'create' && (
        <div className="card hero glow fade-up">
          <div className="eyebrow">New Event</div>
          <form onSubmit={createEvent} style={{ marginTop: 10 }}>
            {error && <div className="banner error">{error}</div>}
            <label htmlFor="ev-name">Event name</label>
            <input id="ev-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night" maxLength={80} autoFocus />
            <label htmlFor="ev-host" style={{ marginTop: 10 }}>
              Host name (optional)
            </label>
            <input id="ev-host" type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="Dr. Chi" maxLength={80} />
            <button type="submit" className="primary lg block" style={{ marginTop: 16 }} disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create Event'}
            </button>
          </form>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="linkish" onClick={() => { setError(null); setView('list'); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {view === 'success' && created && (
        <>
          <div className="row between" style={{ marginBottom: 4 }}>
            <div className="eyebrow">Ready</div>
            <span className="pill live">
              <span className="live-dot" aria-hidden /> Active
            </span>
          </div>
          <div className="display">{created.event.name}</div>

          <div className="card glow fade-up" style={{ marginTop: 14 }}>
            <div className="eyebrow cyan">Step 1</div>
            <div className="display-sm" style={{ margin: '4px 0 10px' }}>
              Make this iPad the DJ
            </div>
            <button
              className="primary lg block"
              disabled={busy}
              onClick={() =>
                setQr({ kind: 'dj', svg: created.djEnrollmentQrSvg, url: created.djEnrollmentUrl, expiresAt: created.djEnrollmentExpiresAt, title: created.event.name })
              }
            >
              Connect Display
            </button>
          </div>

          <div className="card glow" style={{ marginTop: 12 }}>
            <div className="eyebrow">Step 2</div>
            <div className="display-sm" style={{ margin: '4px 0 10px' }}>
              Invite Guests
            </div>
            <div className="stack">
              <button
                className="cyan lg block"
                onClick={() => setQr({ kind: 'guest', svg: created.guestQrSvg, url: created.guestUrl, title: created.event.name })}
              >
                Show Guest QR
              </button>
              <button className="ghost block" onClick={() => copyLink(created.guestUrl)}>
                {copied ? 'Copied!' : 'Copy Guest Link'}
              </button>
              <button className="ghost block" onClick={() => shareLink(created.guestUrl, created.event.name)}>
                Share
              </button>
            </div>
          </div>

          <div className="stack" style={{ marginTop: 20 }}>
            <button
              className="ghost block"
              onClick={() => {
                const id = created.event.id;
                setCreated(null);
                setView('list');
                void loadList();
                void openDetail(id); // straight to detail: stats, QRs, End Event
              }}
            >
              Manage event
            </button>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="linkish" onClick={() => { setCreated(null); setView('list'); void loadList(); }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Event detail sheet */}
      {detail && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Event detail">
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div className="row between">
              <div className="eyebrow">{detail.event.status === 'active' ? 'Active' : detail.event.status}</div>
              <button className="linkish" onClick={closeDetail}>
                Close
              </button>
            </div>
            <div className="display" style={{ margin: '4px 0 12px' }}>
              {detail.event.name}
            </div>

            <div className="card glow">
              <div className="d-meta">DJ</div>
              <div className="d-name">
                {detail.dj.connected ? `Connected${detail.dj.label ? ` · ${detail.dj.label}` : ''}` : 'Not connected'}
              </div>
            </div>

            <div className="metric-row" style={{ marginTop: 12 }}>
              <div className="metric">
                <div className="n">{detail.stats.uniqueGuests}</div>
                <div className="k">guests</div>
              </div>
              <div className="metric">
                <div className="n">{detail.stats.totalRequests}</div>
                <div className="k">songs</div>
              </div>
              <div className="metric">
                <div className="n">{detail.stats.completed}</div>
                <div className="k">done</div>
              </div>
            </div>

            <div className="stack" style={{ margin: '14px 0' }}>
              {detail.event.status === 'active' && (
                <button className="primary lg block" disabled={busy} onClick={() => showDjQr(detail.event.id, detail.event.name)}>
                  Connect Display
                </button>
              )}
              <button
                className="cyan lg block"
                onClick={() => setQr({ kind: 'guest', svg: detail.guestQrSvg, url: detail.guestUrl, title: detail.event.name })}
              >
                Show Guest QR
              </button>
              <a className="btn ghost block" href={`/r/${djRoomSlug(detail.event.publicCode)}/dj`}>
                Open Admin Player
              </a>
            </div>

            {detail.event.status === 'active' &&
              (confirmEnd ? (
                <div className="card" style={{ marginTop: 6, borderColor: 'rgba(255, 92, 124, 0.45)' }}>
                  <div className="d-name">End “{detail.event.name}”?</div>
                  <p className="lead" style={{ marginTop: 6 }}>
                    New song requests will stop. The current queue and history stay — nothing is
                    deleted.
                  </p>
                  <div className="stack" style={{ marginTop: 12 }}>
                    <button className="ghost block" disabled={busy} onClick={() => setConfirmEnd(false)}>
                      Keep Event Open
                    </button>
                    <button className="danger block" disabled={busy} onClick={() => endEvent(detail.event.id)}>
                      {busy ? 'Ending…' : 'End Event'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
                  <button className="danger" disabled={busy} onClick={() => setConfirmEnd(true)}>
                    End Event
                  </button>
                </div>
              ))}
            {detail.event.status !== 'active' && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
                <span className="pill">Event ended · history preserved</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR overlay (guest or DJ) */}
      {qr && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="QR" onClick={() => setQr(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            {qr.kind === 'dj' ? (
              <>
                <div className="eyebrow cyan">DJ Setup · Private</div>
                <div className="display-sm" style={{ margin: '6px 0 12px' }}>
                  Scan with the iPad
                </div>
                {(() => {
                  const secs = pairingSecondsRemaining(qr.expiresAt, nowMs || Date.now());
                  if (secs <= 0) {
                    return <p className="lead">This DJ setup QR has expired. Reopen it for a new one.</p>;
                  }
                  return (
                    <>
                      <div className="qr-surface" dangerouslySetInnerHTML={{ __html: qr.svg }} />
                      <div className="qr-caption">
                        {qr.title} · Expires in <span className="countdown">{formatCountdown(secs)}</span>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="eyebrow">Join {qr.title}</div>
                <div className="display-sm" style={{ margin: '6px 0 12px' }}>
                  Scan to Request a Song
                </div>
                <div className="qr-surface" dangerouslySetInnerHTML={{ __html: qr.svg }} />
                <div className="qr-caption">{qr.url.replace(/^https?:\/\//, '')}</div>
              </>
            )}
            <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>
              Tap anywhere to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
