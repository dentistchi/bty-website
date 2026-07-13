'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import { newArrivals } from '@/domain/queue';
import { PRODUCT_NAME } from '@/lib/brand';
import DjBoard from './DjBoard';

interface Props {
  slug: string;
  displayName: string;
  dev?: boolean;
}

type Phase = 'loading' | 'unpaired' | 'disconnected' | 'authed';

// localStorage (NOT a cookie): the device token is never auto-attached to
// requests and never lands in page HTML. It travels only in an Authorization
// header on explicit DJ calls; a revoked/rotated device drops to 'disconnected'.
// A paired DJ iPad uses the DJ key; an authenticated Admin phone reuses its
// admin key so it can enter the DJ Console WITHOUT pairing (admin ⊇ dj).
const storageKey = (slug: string) => `bty-dj-cred:${slug}`;
const adminKey = (slug: string) => `bty-admin-cred:${slug}`;

const POLL_MS = 4000;
const NEW_HOLD_MS = 4500;

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
}

export default function DjConsole({ slug, displayName, dev = false }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cred, setCred] = useState<string | null>(null);
  const [credSource, setCredSource] = useState<'dj' | 'admin' | null>(null);
  const [data, setData] = useState<QueuePayload | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced bootstrap fallback (host master code) — hidden by default.
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');

  const seenRef = useRef<Set<string>>(new Set());
  const initedRef = useRef(false);

  const authHeader = useCallback((c: string) => ({ authorization: `Bearer ${c}` }), []);

  const markArrivals = useCallback((requests: KaraokeRequest[]) => {
    const ids = requests.map((r) => r.id);
    if (!initedRef.current) {
      // First successful load — seed "seen" so the existing queue isn't "new".
      seenRef.current = new Set(ids);
      initedRef.current = true;
      return;
    }
    const arrivals = newArrivals([...seenRef.current], ids);
    ids.forEach((id) => seenRef.current.add(id));
    if (arrivals.length) {
      setNewIds((prev) => Array.from(new Set([...prev, ...arrivals])));
      window.setTimeout(() => {
        setNewIds((prev) => prev.filter((id) => !arrivals.includes(id)));
      }, NEW_HOLD_MS);
    }
  }, []);

  const loadQueue = useCallback(
    async (c: string): Promise<'ok' | 'unauth' | 'neterr'> => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/queue`, {
          headers: authHeader(c),
          cache: 'no-store',
        });
        if (res.status === 401) return 'unauth';
        if (!res.ok) return 'neterr';
        const payload = (await res.json()) as QueuePayload;
        setData(payload);
        markArrivals(payload.requests ?? []);
        return 'ok';
      } catch {
        return 'neterr';
      }
    },
    [slug, authHeader, markArrivals],
  );

  // On mount: try the paired DJ token first, then the Admin token (admin ⊇ dj).
  // Either landing straight in the console; only fall to the pairing screen when
  // neither authenticates.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const candidates: Array<{ source: 'dj' | 'admin'; key: string; token: string }> = [];
    const djTok = window.localStorage.getItem(storageKey(slug));
    const adminTok = window.localStorage.getItem(adminKey(slug));
    if (djTok) candidates.push({ source: 'dj', key: storageKey(slug), token: djTok });
    if (adminTok) candidates.push({ source: 'admin', key: adminKey(slug), token: adminTok });
    if (candidates.length === 0) {
      setPhase('unpaired');
      return;
    }
    (async () => {
      for (const c of candidates) {
        const r = await loadQueue(c.token);
        if (r === 'ok') {
          setCred(c.token);
          setCredSource(c.source);
          setPhase('authed');
          return;
        }
        if (r === 'unauth') {
          window.localStorage.removeItem(c.key); // stale token — drop it, try the next
          continue;
        }
        // Network hiccup on cold open — keep the token, show reconnecting.
        setCred(c.token);
        setCredSource(c.source);
        setReconnecting(true);
        setPhase('authed');
        return;
      }
      setPhase('unpaired');
    })();
  }, [slug, loadQueue]);

  // Live polling while authed.
  useEffect(() => {
    if (phase !== 'authed' || !cred) return;
    const t = window.setInterval(async () => {
      const r = await loadQueue(cred);
      if (r === 'unauth') {
        setPhase('disconnected');
      } else {
        setReconnecting(r === 'neterr');
      }
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [phase, cred, loadQueue]);

  const refresh = useCallback(async () => {
    if (!cred) return;
    const r = await loadQueue(cred);
    if (r === 'unauth') setPhase('disconnected');
    else setReconnecting(r === 'neterr');
  }, [cred, loadQueue]);

  async function mutate(id: string, action: 'play' | 'complete' | 'skip' | 'remove' | 'move_next') {
    if (!cred) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(slug)}/requests/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { ...authHeader(cred), 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      if (res.status === 401) {
        setPhase('disconnected');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'That action failed.');
        return;
      }
      await loadQueue(cred);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  function disconnectManual() {
    // Only ever clears the DJ pairing on this device. An Admin using the console
    // via their admin session keeps that session (they manage via the Admin menu),
    // so we never wipe the admin key here.
    window.localStorage.removeItem(storageKey(slug));
    setCred(null);
    setCredSource(null);
    setData(null);
    initedRef.current = false;
    seenRef.current = new Set();
    setPhase('unpaired');
  }

  // Advanced bootstrap: connect with the host master code (rarely needed).
  async function connectWithCode(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/verify`, {
        method: 'POST',
        headers: authHeader(c),
      });
      if (!res.ok) {
        setError('That host code is not valid.');
        return;
      }
      window.localStorage.setItem(storageKey(slug), c);
      setCred(c);
      setCredSource('dj');
      setCode('');
      initedRef.current = false;
      await loadQueue(c);
      setPhase('authed');
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  const brandHead = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">DJ</span>
    </div>
  );

  if (phase === 'loading') {
    return (
      <main>
        {brandHead}
        <p className="lead">Opening the DJ console…</p>
      </main>
    );
  }

  if (phase === 'unpaired' || phase === 'disconnected') {
    const ended = phase === 'disconnected';
    return (
      <main>
        {brandHead}
        <div className="card hero glow fade-up">
        <div className="eyebrow cyan">{ended ? 'DJ connection ended' : 'Not connected yet'}</div>
        <div className="display-sm" style={{ marginTop: 6 }}>
          {ended ? `This iPad is no longer connected to ${displayName}.` : `Connect this iPad to ${displayName}`}
        </div>
        <p className="lead">
          Ask the host to open <b>Connect a DJ iPad</b> on their phone, then scan the QR with this
          iPad’s camera.
        </p>
        {error && <div className="banner error">{error}</div>}
        {ended && (
          <button className="primary lg block" style={{ marginTop: 14 }} onClick={disconnectManual}>
            Pair this iPad again
          </button>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="linkish" onClick={() => setShowCode((s) => !s)}>
            {showCode ? 'Hide host code' : 'Use host code instead'}
          </button>
          {showCode && (
            <form onSubmit={connectWithCode} style={{ marginTop: 8 }}>
              <input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Host code"
              />
              <button
                type="submit"
                className="ghost block"
                style={{ marginTop: 10 }}
                disabled={busy || !code.trim()}
              >
                {busy ? 'Connecting…' : 'Connect with host code'}
              </button>
            </form>
          )}
        </div>
        </div>
      </main>
    );
  }

  return (
    <DjBoard
      slug={slug}
      displayName={displayName}
      data={data}
      newIds={newIds}
      reconnecting={reconnecting}
      busy={busy}
      error={error}
      dev={dev}
      adminCred={data?.role === 'admin' ? cred : null}
      onStart={(id) => mutate(id, 'play')}
      onFinish={(id) => mutate(id, 'complete')}
      onMoveNext={(id) => mutate(id, 'move_next')}
      onRemove={(id) => mutate(id, 'remove')}
      onRefresh={refresh}
      onDisconnect={disconnectManual}
    />
  );
}
