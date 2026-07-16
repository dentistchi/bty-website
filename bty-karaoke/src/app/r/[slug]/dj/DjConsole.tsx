'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import type { DjEventStatus } from '@/lib/events.server';
import { newArrivals } from '@/domain/queue';
import { safeYoutubeWatchUrl } from '@/domain/youtube';
import { PRODUCT_NAME } from '@/lib/brand';
import DjBoard from './DjBoard';

interface Props {
  slug: string;
  displayName: string;
  dev?: boolean;
  /**
   * V6.2: when the Player is rendered inside an ALREADY-authenticated Admin (the
   * room admin console), the Admin's session credential is passed here. The Player
   * reuses it as its sole auth and NEVER re-authenticates or shows the legacy
   * host-code / pairing screen — Admin authenticates exactly once. (authorizeDj ⊇
   * authorizeAdmin, so an admin cred always authorizes the queue.)
   */
  sessionCred?: string | null;
}

type Phase = 'loading' | 'unpaired' | 'disconnected' | 'authed';

// localStorage (NOT a cookie): the device token is never auto-attached to
// requests and never lands in page HTML. It travels only in an Authorization
// header on explicit DJ calls; a revoked/rotated device drops to 'disconnected'.
// A paired DJ iPad uses the DJ key; an authenticated Admin phone reuses its
// admin key so it can enter the DJ Console WITHOUT pairing (admin ⊇ dj).
const storageKey = (slug: string) => `bty-dj-cred:${slug}`;
const adminKey = (slug: string) => `bty-admin-cred:${slug}`;

// Last-good queue snapshot (sessionStorage, per-tab). Hydrated on mount so that
// returning from the YouTube app — which reloads this tab — shows NOW SINGING +
// Finish Song + the queue INSTANTLY from canonical cache, while we re-verify in
// the background. Never holds a credential; only the public queue payload.
const queueCacheKey = (slug: string) => `bty-dj-queue:${slug}`;
function readQueueCache(slug: string): QueuePayload | null {
  try {
    const raw = window.sessionStorage.getItem(queueCacheKey(slug));
    return raw ? (JSON.parse(raw) as QueuePayload) : null;
  } catch {
    return null;
  }
}
function saveQueueCache(slug: string, payload: QueuePayload) {
  try {
    window.sessionStorage.setItem(queueCacheKey(slug), JSON.stringify(payload));
  } catch {
    /* storage full / disabled — cache is best-effort */
  }
}

const POLL_MS = 4000;
const NEW_HOLD_MS = 4500;

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
  /** Event context (null for legacy non-event rooms) — powers the status sheet. */
  eventStatus: DjEventStatus | null;
}

export default function DjConsole({ slug, displayName, dev = false, sessionCred = null }: Props) {
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
  // Monotonic load counter: a slow older /dj/queue response can never overwrite a
  // newer one (which would, e.g., briefly drop the playing row and hide Finish).
  const loadSeqRef = useRef(0);

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
      const seq = ++loadSeqRef.current;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/queue`, {
          headers: authHeader(c),
          cache: 'no-store',
        });
        if (res.status === 401) return 'unauth';
        if (!res.ok) return 'neterr';
        const payload = (await res.json()) as QueuePayload;
        // Drop a stale response if a newer load already landed — protects the
        // canonical playing state (Finish Song) from out-of-order overwrites.
        if (seq !== loadSeqRef.current) return 'ok';
        setData(payload);
        saveQueueCache(slug, payload);
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
    // V6.2: rendered inside an authenticated Admin — reuse that session credential
    // as the ONLY auth. No pairing, no host code, no re-authentication. A cred that
    // passed authorizeAdmin always passes authorizeDj, so /dj/queue accepts it; a
    // transient failure only shows "reconnecting", never the host-code screen.
    if (sessionCred) {
      setCred(sessionCred);
      setCredSource('admin');
      setPhase('authed');
      const cached = readQueueCache(slug);
      if (cached) setData(cached);
      setReconnecting(true);
      void loadQueue(sessionCred).then((r) => setReconnecting(r !== 'ok'));
      return;
    }
    const candidates: Array<{ source: 'dj' | 'admin'; key: string; token: string }> = [];
    const djTok = window.localStorage.getItem(storageKey(slug));
    const adminTok = window.localStorage.getItem(adminKey(slug));
    if (djTok) candidates.push({ source: 'dj', key: storageKey(slug), token: djTok });
    if (adminTok) candidates.push({ source: 'admin', key: adminKey(slug), token: adminTok });
    if (candidates.length === 0) {
      setPhase('unpaired');
      return;
    }
    // Instant restore: if this tab has a cached queue (e.g. we just came back
    // from the YouTube app, which reloaded the page), show the board immediately
    // with canonical NOW SINGING + Finish Song while we re-verify below. No
    // loading gap where the stage looks empty.
    const cached = readQueueCache(slug);
    if (cached) {
      setData(cached);
      setCred(candidates[0].token);
      setCredSource(candidates[0].source);
      setReconnecting(true);
      setPhase('authed');
    }
    (async () => {
      for (const c of candidates) {
        const r = await loadQueue(c.token);
        if (r === 'ok') {
          setCred(c.token);
          setCredSource(c.source);
          setReconnecting(false);
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
      // Every candidate token was definitively rejected (401). If we had shown a
      // cached board, the device was revoked → disconnected; otherwise unpaired.
      setPhase(cached ? 'disconnected' : 'unpaired');
    })();
  }, [slug, loadQueue, sessionCred]);

  // Live polling while authed.
  useEffect(() => {
    if (phase !== 'authed' || !cred) return;
    const t = window.setInterval(async () => {
      const r = await loadQueue(cred);
      // With an Admin session cred a 401 is not expected (authorizeDj ⊇
      // authorizeAdmin) and must never drop to the host-code screen — treat any
      // hiccup as reconnecting and keep the Player up.
      if (r === 'unauth' && !sessionCred) {
        setPhase('disconnected');
      } else {
        setReconnecting(r !== 'ok');
      }
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [phase, cred, loadQueue, sessionCred]);

  const refresh = useCallback(async () => {
    if (!cred) return;
    const r = await loadQueue(cred);
    if (r === 'unauth') setPhase('disconnected');
    else setReconnecting(r === 'neterr');
  }, [cred, loadQueue]);

  // Idempotent viewport+state restore for EVERY return path from the YouTube app.
  // Blurring any focused input snaps iOS Safari back from an auto-zoomed state to
  // 1.0 scale; then we refetch canonical truth (NOW SINGING / Finish / queue).
  // Safe to call repeatedly (duplicate return events overlap harmlessly).
  const restoreView = useCallback(() => {
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* ignore */
    }
    void refresh();
  }, [refresh]);

  // Returning from YouTube (foreground/bfcache) refreshes the queue ONCE so the
  // console is immediately current — not a new polling loop, just a single
  // event-driven refresh per return. The 4s interval above is unchanged.
  useEffect(() => {
    if (phase !== 'authed') return;
    // Any signal that we're back in front of the DJ (tab visible again, window
    // refocused, or bfcache restore) triggers ONE canonical refresh so NOW
    // SINGING / Finish Song / Guest QR / UP NEXT are current with no manual
    // reload. This is the return path after a YouTube-app handoff.
    const onVisible = () => {
      if (document.visibilityState === 'visible') restoreView();
    };
    const onFocus = () => restoreView();
    const onPageShow = () => restoreView(); // fresh load AND bfcache restore
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [phase, restoreView]);

  async function mutate(
    id: string,
    action: 'play' | 'complete' | 'skip' | 'remove' | 'move_next',
  ): Promise<boolean> {
    if (!cred) return false;
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
        return false;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'That action failed.');
        return false;
      }
      await loadQueue(cred);
      return true;
    } catch {
      setError('Network error.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Admin Player (V6): start the canonical next song, THEN hand off to YouTube on
  // this ONE device to cast to the TV. Start FIRST so a failure never opens
  // YouTube; same-window navigation opens the YouTube app (no blank tab).
  async function playOnTv(id: string, videoId: string) {
    const ok = await mutate(id, 'play');
    if (!ok) return;
    const url = safeYoutubeWatchUrl(videoId);
    if (url) window.location.assign(url);
  }
  // Re-open the playing video on the TV without any state change.
  function reopenOnTv(videoId: string) {
    const url = safeYoutubeWatchUrl(videoId);
    if (url) window.location.assign(url);
  }

  // Persist a DJ reorder of the waiting queue. Returns a coarse result so the
  // board can keep or roll back its optimistic order. On 401 we drop to
  // disconnected; on 409 (queue changed under the DJ) and on any failure we
  // refetch canonical truth so the board rolls back to the server order.
  async function reorder(orderedRequestIds: string[]): Promise<'ok' | 'conflict' | 'error'> {
    if (!cred) return 'error';
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/reorder`, {
        method: 'POST',
        headers: { ...authHeader(cred), 'content-type': 'application/json' },
        body: JSON.stringify({ orderedRequestIds }),
      });
      if (res.status === 401) {
        setPhase('disconnected');
        return 'error';
      }
      if (res.status === 409) {
        await loadQueue(cred); // queue changed — resync to canonical
        return 'conflict';
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Could not save the new order.');
        await loadQueue(cred);
        return 'error';
      }
      await loadQueue(cred);
      return 'ok';
    } catch {
      setError('Network error.');
      await loadQueue(cred).catch(() => undefined);
      return 'error';
    } finally {
      setBusy(false);
    }
  }

  // DJ adds a song on a guest's behalf. Reuses the DJ credential; the server
  // appends an ordinary waiting request (tail) to the canonical queue. Refetches
  // so the new song appears immediately in UP NEXT and guest #N.
  async function addSong(payload: Record<string, unknown>): Promise<'ok' | 'error'> {
    if (!cred) return 'error';
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/requests`, {
        method: 'POST',
        headers: { ...authHeader(cred), 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        setPhase('disconnected');
        return 'error';
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Could not add the song.');
        return 'error';
      }
      await loadQueue(cred);
      return 'ok';
    } catch {
      setError('Network error.');
      return 'error';
    }
  }

  // End the whole EVENT (distinct from disconnecting this iPad). Uses this
  // device's existing DJ credential — no manager token is created here.
  async function endEvent(): Promise<'ok' | 'error'> {
    if (!cred) return 'error';
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/end-event`, {
        method: 'POST',
        headers: authHeader(cred),
      });
      if (res.status === 401) {
        setPhase('disconnected');
        return 'error';
      }
      if (!res.ok) return 'error';
      await loadQueue(cred); // header + sheet reflect the ended state
      return 'ok';
    } catch {
      return 'error';
    }
  }

  function disconnectManual() {
    // Only ever clears the DJ pairing on this device. An Admin using the console
    // via their admin session keeps that session (they manage via the Admin menu),
    // so we never wipe the admin key here.
    window.localStorage.removeItem(storageKey(slug));
    try {
      window.sessionStorage.removeItem(queueCacheKey(slug));
    } catch {
      /* ignore */
    }
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

  // V6.2: an authenticated Admin NEVER sees the pairing / host-code screen. If the
  // Player is rendered with an Admin session cred, a transient issue shows a quiet
  // reconnecting state instead of asking for a host code (which no longer exists).
  if ((phase === 'unpaired' || phase === 'disconnected') && sessionCred) {
    return (
      <main>
        {brandHead}
        <div className="reconnecting" role="status">
          <span className="status-dot warn" aria-hidden /> Reconnecting… your session is safe.
        </div>
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
          Ask the host to open <b>Connect Display iPad</b> on their phone, then scan the QR with this
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
      onStart={(id) => { void mutate(id, 'play'); }}
      onPlayOnTv={playOnTv}
      onReopen={reopenOnTv}
      onFinish={(id) => { void mutate(id, 'complete'); }}
      onMoveNext={(id) => { void mutate(id, 'move_next'); }}
      onRemove={(id) => { void mutate(id, 'remove'); }}
      onReorder={reorder}
      onAddSong={addSong}
      onRefresh={refresh}
      onDisconnect={disconnectManual}
      onEndEvent={endEvent}
    />
  );
}
