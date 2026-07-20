'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DjDevice } from '@/lib/devices.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import { PRODUCT_NAME } from '@/lib/brand';
import { pairingSecondsRemaining, formatCountdown } from '@/domain/pairing';
import { adminAuthHeader, finalizeAdminAuth, COOKIE_CRED } from '@/domain/admin-auth';
import DjConsole from '../dj/DjConsole';

interface Props {
  slug: string;
  displayName: string;
}

type Phase = 'loading' | 'need-auth' | 'authed' | 'unavailable';

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
  const [pin, setPin] = useState('');
  const [showHostCode, setShowHostCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<KaraokeSession | null>(null);
  const [stats, setStats] = useState<{ requests: number; guests: number }>({ requests: 0, guests: 0 });
  const [devices, setDevices] = useState<DjDevice[]>([]);

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairedLabel, setPairedLabel] = useState<string | null>(null);
  const [guestQr, setGuestQr] = useState<GuestQr | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => 0);

  // Mode-aware: a Bearer token sends the header; the cookie sentinel (or null)
  // sends NO header so the browser attaches the same-origin HttpOnly `bty_room`.
  const authHeader = useCallback((c: string | null) => adminAuthHeader(c), []);

  // Tri-state (like DjConsole): 401 is a DEFINITIVE reject; anything else is a
  // transient error we must NOT treat as "not enrolled". Passing null probes the
  // Room cookie (Slice 2.1).
  const loadSession = useCallback(
    async (c: string | null): Promise<'ok' | 'unauth' | 'neterr'> => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/session`, {
          headers: authHeader(c),
          cache: 'no-store',
        });
        if (res.status === 401) return 'unauth';
        if (!res.ok) return 'neterr';
        const data = await res.json();
        setSession(data.session ?? null);
        setStats(data.stats ?? { requests: 0, guests: 0 });
        return 'ok';
      } catch {
        return 'neterr';
      }
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

  // On mount: restore the stored Admin device session. A VALID session always
  // takes precedence; the PIN form appears ONLY on a definitive 401 or when no
  // credential is stored. Transient failures retry quietly — never flash the PIN
  // form (the bug where a slow mobile-Safari /admin/session fetch showed the PIN).
  const [resolveNonce, setResolveNonce] = useState(0);
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey(slug)) : null;
    let cancelled = false;
    setPhase('loading');
    (async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        // Bearer FIRST — unchanged priority. Only when it is absent or definitively
        // rejected do we probe the Room cookie (no Authorization header).
        const bearer = saved ? await loadSession(saved) : null;
        if (cancelled) return;
        if (bearer === 'ok') {
          setCred(saved);
          setPhase('authed');
          void loadDevices(saved!);
          return;
        }
        const cookie = await loadSession(null);   // cookie probe (same-origin)
        if (cancelled) return;

        const r = finalizeAdminAuth(bearer, cookie);
        if (r.phase === 'authed') {
          // A valid cookie with a dead Bearer → drop the dead local token.
          if (r.mode === 'cookie' && saved) window.localStorage.removeItem(storageKey(slug));
          const c = r.mode === 'cookie' ? COOKIE_CRED : saved!;
          setCred(c);
          setPhase('authed');
          void loadDevices(c);
          return;
        }
        if (r.phase === 'need-auth') {
          if (saved) window.localStorage.removeItem(storageKey(slug)); // dead Bearer
          setPhase('need-auth');
          return;
        }
        // 'retry' — a transient failure on EITHER path. Never show pairing here.
        await new Promise((res) => window.setTimeout(res, 400 * (attempt + 1)));
      }
      if (cancelled) return;
      // Exhausted with only transient failures. A stored Bearer takes precedence
      // (polling signs out on a real 401); otherwise we cannot confirm auth, so
      // show an honest retry state rather than pairing or a fake authed screen.
      if (saved) {
        setCred(saved);
        setPhase('authed');
        void loadDevices(saved);
      } else {
        setPhase('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, loadSession, loadDevices, resolveNonce]);

  /** Called when the active credential is server-rejected mid-session (e.g. the
   *  Room cookie was revoked): re-run resolution instead of faking authed. */
  const revalidate = useCallback(() => setResolveNonce((n) => n + 1), []);

  // Ticking clock for the pairing countdown (only while a code is shown).
  useEffect(() => {
    if (!pairing) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pairing]);

  // Primary enrollment on an already-set-up room: enter the Admin PIN → mint a
  // new durable admin device (uniform failure; no leak of room/PIN state).
  async function enrollWithPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = pin;
    if (!p) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/enroll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      window.localStorage.setItem(storageKey(slug), data.adminToken);
      setCred(data.adminToken);
      setPin('');
      await loadSession(data.adminToken);
      await loadDevices(data.adminToken);
      setPhase('authed');
      vibrate(12);
    } catch {
      setError('네트워크 오류입니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  // Advanced fallback: exchange the master credential (host code) for a durable
  // admin device token, then keep only the device token.
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
    setError(null);
    const res = await adminCall(`/admin/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res) return;
    if (res.ok) {
      if (cred) void loadDevices(cred);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? '기기를 해제하지 못했어요.');
    }
  }

  async function rotate() {
    if (!window.confirm('Rotate Display access? Every paired Display iPad must scan a new code to reconnect.')) return;
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

  // Only transient failures so far and no stored credential — an HONEST retry
  // state (§4 Outcome C). NEVER the pairing form: a network blip is not "no auth".
  if (phase === 'unavailable') {
    return (
      <>
        {brandHead}
        <div className="card hero" role="status">
          <p className="lead">일시적으로 연결하지 못했어요.</p>
          <p className="muted">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
          <button className="primary" onClick={revalidate}>다시 시도</button>
        </div>
      </>
    );
  }

  if (phase === 'need-auth') {
    return (
      <>
        {brandHead}
        <div className="card hero glow">
          <div className="eyebrow">관리자 기기 등록</div>
          <div className="display-sm" style={{ marginTop: 6 }}>
            {displayName} 관리자
          </div>
          <p className="lead">관리자 PIN을 입력하면 이 iPhone이 관리자로 등록돼요.</p>
          <form onSubmit={enrollWithPin} style={{ marginTop: 12 }}>
            {error && <div className="banner error">{error}</div>}
            <label htmlFor="adminpin">관리자 PIN</label>
            <input
              id="adminpin"
              type="password"
              inputMode="text"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="관리자 PIN"
            />
            <button
              type="submit"
              className="primary lg block"
              style={{ marginTop: 14 }}
              disabled={busy || !pin}
            >
              {busy ? '등록 중…' : '이 iPhone을 관리자로 등록'}
            </button>
          </form>
          <p className="lead" style={{ marginTop: 14, fontSize: '0.9rem' }}>
            아직 PIN이 없다면, Mac에서 만든 <b>설정 QR</b>을 스캔해 처음 등록하세요.
          </p>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="linkish" onClick={() => setShowHostCode((s) => !s)}>
              {showHostCode ? '숨기기' : '고급: 호스트 코드로 등록'}
            </button>
            {showHostCode && (
              <form onSubmit={connect} style={{ marginTop: 8 }}>
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
                  className="ghost block"
                  style={{ marginTop: 10 }}
                  disabled={busy || !input.trim()}
                >
                  {busy ? '확인 중…' : '호스트 코드로 등록'}
                </button>
              </form>
            )}
          </div>
        </div>
      </>
    );
  }

  const live = Boolean(session);

  // V6.1: an authenticated room admin lands DIRECTLY on the Admin Player — the one
  // canonical operating screen (Player Hero + queue + admin menu with Guest QR,
  // Connect Display iPad, Devices). No extra console hop — the old stats/devices
  // screen is retired; the Player is the operating surface.
  return (
    <DjConsole slug={slug} displayName={displayName} sessionCred={cred} onSessionInvalid={revalidate} />
  );
}
