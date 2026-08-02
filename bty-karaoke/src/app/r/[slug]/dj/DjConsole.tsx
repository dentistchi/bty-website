'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import type { DjEventStatus } from '@/lib/events.server';
import { newArrivals } from '@/domain/queue';
import { safeYoutubeWatchUrl } from '@/domain/youtube';
import {
  playerHref,
  playerWindowName,
  playerChannelName,
  buildPlayCommand,
} from '@/domain/player-channel';
import { isNativeHost, nativeOpenYouTube } from '@/lib/native-bridge';
import { PRODUCT_NAME } from '@/lib/brand';
import DjBoard from './DjBoard';
import UsageBanner from './UsageBanner';
import { adminAuthHeader, isCookieCred } from '@/domain/admin-auth';
import type { UsageProjection } from '@/domain/usage';
import { upgradeRequiredCopy } from '@/domain/admission-copy';
import type { PlaybackAuthorityWire } from '@/domain/playback-clock';

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
  /** Slice 2.1: called when the passed session credential is server-rejected (401)
   *  — used for the Host web COOKIE credential so a revoked cookie exits protected
   *  state and re-resolves, instead of silently staying "authed". */
  onSessionInvalid?: () => void;
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

/**
 * BUILD 21 — a fail-closed admission block, bound to the canonical request it refers to.
 *
 * `reason` is the server's classification when it sent one; the message is always the server's
 * sentence, so the wording lives in exactly one place (the route) and this client never invents
 * an explanation it cannot justify.
 */
export interface AdmissionBlock {
  requestId: string;
  reason?: string;
  message: string;
}

/**
 * Pure reconciliation: is this block still about something real?
 *
 * Identity is the canonical `requestId` and NOTHING else. Two queue rows may legitimately carry
 * the same youtube_video_id, the same title, and the same artist — an 18B same-song repeat is a
 * genuinely distinct request. Matching on song identity would keep a dead notice alive whenever a
 * twin of the blocked song is still queued (and, symmetrically, attach one request's failure to
 * another's row), so the comparison must never fall back to videoId/title/position.
 *
 * `queueRequestIds` must be CANONICAL server truth. The caller is responsible for not passing an
 * empty list before the first successful load — "we haven't loaded yet" is not "it's gone".
 */
export function reconcileAdmissionBlock(
  block: AdmissionBlock | null,
  queueRequestIds: readonly string[],
): AdmissionBlock | null {
  if (!block) return null;
  // Same object identity when retained, so a poll-driven reconcile never re-renders.
  return queueRequestIds.includes(block.requestId) ? block : null;
}

/** BUILD 23 — the `/dj/pass-turn` 200 body, as far as this console cares. */
export interface PassTurnBody {
  reason?: string;
  blockedRequestId?: string | null;
  message?: string;
  durationFailureReason?: string;
  promoted?: { id: string } | null;
  // BUILD 24-G1 — the allowlisted admission detail, now published on `upgrade_required` too so
  // the refusal can be described with the authority's own numbers instead of an assumption.
  // All optional: an older server omits them and the copy degrades to its safe wording.
  remainingSeconds?: number;
  requiredChargeSeconds?: number;
  durationSeconds?: number;
}

/**
 * BUILD 23 — what the console must do with a `/dj/pass-turn` success body.
 *
 * `upgrade_required` and `not_promoted` are the SHIPPED branches, unchanged. `admission_block` is
 * the new one: the current song completed, but the next start was refused fail-closed. It used to
 * fall into `not_promoted` and render "다음 준비된 참가자를 기다리는 중이에요." — a claim that the
 * next singer had not pressed Ready, when pressing Ready is precisely why the server chose them.
 *
 * Pure so every branch is testable without rendering the console. It decides NOTHING about the
 * queue: no retry, no removal, no skip, no reorder is representable in the return type.
 */
export type PassTurnDecision =
  | { kind: 'upgrade_required' }
  | { kind: 'admission_block'; block: AdmissionBlock }
  | { kind: 'not_promoted' }
  | { kind: 'promoted'; promotedId: string | null };

export function resolvePassTurnDecision(
  body: PassTurnBody,
  fallbackRequestId: string,
): PassTurnDecision {
  if (body.reason === 'upgrade_required') return { kind: 'upgrade_required' };
  if (body.reason === 'duration_unavailable' || body.reason === 'pass_insufficient') {
    return {
      kind: 'admission_block',
      block: {
        // Identity is the server's canonical blocked id. `fallbackRequestId` is the console's own
        // ready-first promote target — resolved by the SAME canonical rule — so it is the honest
        // degradation if an older server omits the id. Never videoId/title/artist/position: an 18B
        // same-song repeat is a genuinely different request.
        requestId: body.blockedRequestId ?? fallbackRequestId,
        // Absent only on an older server; the reason is never inferred from anything else.
        reason: body.durationFailureReason,
        // The server owns the wording (one shared source with /dj/start), so this client can
        // never invent an explanation it cannot justify.
        message: body.message ?? '다음 곡을 시작하지 못했습니다.',
      },
    };
  }
  if (body.reason !== 'promoted') return { kind: 'not_promoted' };
  return { kind: 'promoted', promotedId: body.promoted?.id ?? null };
}

/**
 * BUILD 23 — a promotion supersedes ONLY that song's own block.
 *
 * A DIFFERENT request starting is deliberately NOT a clear: the blocked song is still queued and
 * still unplayable, so its explanation must survive the operator moving on to another song.
 */
export function clearBlockSupersededBy(
  block: AdmissionBlock | null,
  startedRequestId: string | null,
): AdmissionBlock | null {
  if (!block || !startedRequestId) return block;
  return block.requestId === startedRequestId ? null : block;
}

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
  /** Event context (null for legacy non-event rooms) — powers the status sheet. */
  eventStatus: DjEventStatus | null;
  /**
   * BUILD 24 — the server-stamped anchor the live song clock projects from. Optional so a
   * console served by an older Worker simply shows no clock instead of inventing one.
   */
  playback?: PlaybackAuthorityWire | null;
}

export default function DjConsole({ slug, displayName, dev = false, sessionCred = null, onSessionInvalid }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cred, setCred] = useState<string | null>(null);
  const [credSource, setCredSource] = useState<'dj' | 'admin' | null>(null);
  const [data, setData] = useState<QueuePayload | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // BUILD 21 — the fail-closed ADMISSION block, kept apart from `error` on purpose.
  //
  // `error` is transient action feedback: every mutation handler clears it on its next attempt.
  // An admission block is different — the song is still in the queue and STILL cannot start, so
  // the explanation has to outlive polling and outlive the Host's next unrelated action.
  //
  // It is keyed by canonical requestId, never by videoId/title/position: a same-song repeat is a
  // legitimately different request (18B), so blocking "this request" must never silently attach
  // itself to its twin.
  const [admissionBlock, setAdmissionBlock] = useState<AdmissionBlock | null>(null);
  // Set ONLY when the same-origin BTY Player tab could not be opened (popup blocked). The
  // Admin stays fully open and we surface an explicit "Open the Player" link instead — the
  // Admin tab is never navigated away by the handoff.
  const [showPlayerFallback, setShowPlayerFallback] = useState(false);
  // B2 — server-truth FREE-minutes usage projection (remaining, warning banner, block).
  // Polled on the queue cadence and refreshed instantly from a blocked start's response.
  const [usage, setUsage] = useState<UsageProjection | null>(null);

  // Advanced bootstrap fallback (host master code) — hidden by default.
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');

  const seenRef = useRef<Set<string>>(new Set());
  const initedRef = useRef(false);
  // Exactly ONE same-origin BTY Player tab per Room. The Player stays on our origin and
  // swaps the embedded video via the IFrame API — so, unlike the youtube.com popup (whose
  // COOP severed the named handle and spawned a tab per song), the named browsing context
  // reliably reuses. We retain the WindowProxy while DjConsole is mounted; the actual video
  // command is delivered over a Room-scoped BroadcastChannel (with canonical polling as the
  // authority in the Player). The Admin tab is never navigated away.
  const ytWinRef = useRef<Window | null>(null);
  // Monotonic load counter: a slow older /dj/queue response can never overwrite a
  // newer one (which would, e.g., briefly drop the playing row and hide Finish).
  const loadSeqRef = useRef(0);

  // Mode-aware: the cookie sentinel sends NO header so the browser attaches the
  // same-origin HttpOnly bty_room cookie (Slice 2.1).
  const authHeader = useCallback((c: string) => adminAuthHeader(c), []);

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

  // BUILD 21 — reconcile the admission block against canonical queue truth after every load.
  // Guarded on `data`: before the first successful load there is no canonical list, and
  // "not loaded yet" must never be mistaken for "the request is gone". `reconcileAdmissionBlock`
  // returns the SAME object when the block survives, so a poll causes no re-render.
  useEffect(() => {
    if (!data) return;
    setAdmissionBlock((prev) => reconcileAdmissionBlock(prev, (data.requests ?? []).map((r) => r.id)));
  }, [data]);

  // B2 — fetch the server-truth usage projection (FREE minutes remaining / warning /
  // block). Best-effort: a hiccup just leaves the last-known banner in place. The
  // server is always the enforcement authority; this only drives what the Admin SEES.
  const loadUsage = useCallback(
    async (c: string): Promise<void> => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/usage`, {
          headers: authHeader(c),
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { usage?: UsageProjection | null };
        setUsage(body.usage ?? null);
      } catch {
        /* keep the last-known banner */
      }
    },
    [slug, authHeader],
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
    void loadUsage(cred); // seed the usage banner immediately on entering the console
    const t = window.setInterval(async () => {
      void loadUsage(cred); // refresh the FREE-minutes banner on the same cadence
      const r = await loadQueue(cred);
      // With an Admin session cred a 401 is not expected (authorizeDj ⊇
      // authorizeAdmin) and must never drop to the host-code screen — treat any
      // hiccup as reconnecting and keep the Player up.
      if (r === 'unauth') {
        if (isCookieCred(sessionCred)) {
          // Revoked/expired Room cookie → stop protected polling and re-resolve.
          onSessionInvalid?.();
        } else if (!sessionCred) {
          setPhase('disconnected');
        } else {
          // A Bearer admin cred: a 401 here is unexpected; keep the Player up.
          setReconnecting(true);
        }
      } else {
        setReconnecting(r !== 'ok');
      }
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [phase, cred, loadQueue, loadUsage, sessionCred, onSessionInvalid]);

  const refresh = useCallback(async () => {
    if (!cred) return;
    void loadUsage(cred); // keep the FREE-minutes banner current on every canonical refresh
    const r = await loadQueue(cred);
    if (r === 'unauth') setPhase('disconnected');
    else setReconnecting(r === 'neterr');
  }, [cred, loadQueue, loadUsage]);

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

  // V9.0 — the ONE operator action: "play the next song". The operator never thinks
  // about state transitions; this performs every required one, in the only safe order
  // for same-window navigation (all server mutations finish BEFORE we leave Safari):
  //
  //   • a song is playing → POST /dj/pass-turn: completes the current song AND auto-
  //     promotes the earliest READY song (canonical ready-first, reused from V8.1).
  //   • nothing playing (first song) → POST /dj/start: idempotently ensures the first
  //     READY song is the stage.
  //
  // Then revalidate (Display + Personal Player read the canonical `playing` on their
  // own polls) and ONLY THEN navigate to the promoted song's YouTube. On a precise
  // failure we show the server's reason and never navigate. `nextVideoId` is the
  // READY TO PLAY card's subject — the deterministic ready-first promote target.
  async function playNext(nextId: string, nextVideoId: string) {
    if (!cred) return;
    // PLATFORM SPLIT (capability-detected, never user-agent):
    //  • NATIVE iPhone app → hand YouTube off to the external YouTube app (preserves Admin
    //    state + the app's TV/Cast link). Never opens the BTY Player, never posts a channel
    //    command. This is the canonical production path and is left exactly as it was.
    //  • WEB browser → open/reuse the ONE same-origin BTY Player tab.
    // BOTH paths run EXACTLY ONE lifecycle transition per click (below); the handoff differs.
    const native = isNativeHost();
    const watchUrl = safeYoutubeWatchUrl(nextVideoId);
    // WEB ONLY: ensure the one same-origin Player tab exists. Reuse the retained WindowProxy
    // if still open; otherwise open the Player route in the stable Room-scoped NAMED context
    // SYNCHRONOUSLY within this click gesture (popup-safe; a manually-closed Player is
    // recreated exactly once). Same-origin ⇒ the named context reliably reuses (no
    // tab-per-song accumulation). Skipped entirely on native.
    let playerWin: Window | null = null;
    let createdFresh = false;
    if (!native) {
      playerWin = ytWinRef.current && !ytWinRef.current.closed ? ytWinRef.current : null;
      if (!playerWin && typeof window !== 'undefined') {
        playerWin = window.open(playerHref(slug), playerWindowName(slug));
        if (playerWin) {
          createdFresh = true;
          try {
            playerWin.opener = null; // hygiene — the Player never uses opener
          } catch {
            /* some browsers disallow assigning opener — safe to ignore */
          }
        }
      }
      ytWinRef.current = playerWin;
    }
    const closePlayerOnFailure = () => {
      if (!native && createdFresh && playerWin && !playerWin.closed) {
        try {
          playerWin.close();
        } catch {
          /* ignore */
        }
        ytWinRef.current = null;
      }
    };
    const cur = (data?.requests ?? []).find((r) => r.status === 'playing') ?? null;
    setError(null);
    setShowPlayerFallback(false);
    setBusy(true);
    try {
      if (cur) {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/pass-turn`, {
          method: 'POST',
          headers: { ...authHeader(cred), 'content-type': 'application/json' },
          body: JSON.stringify({ currentId: cur.id }),
        });
        if (res.status === 401) {
          closePlayerOnFailure();
          setPhase('disconnected');
          return;
        }
        if (!res.ok) {
          closePlayerOnFailure();
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? '다음 곡을 재생하지 못했습니다.');
          return;
        }
        const body = (await res.json().catch(() => ({}))) as PassTurnBody & {
          usage?: UsageProjection | null;
        };
        // Reload FIRST, then publish: `loadQueue` reconciles the notice against canonical rows,
        // and a notice set before it would be reconciled against a queue that predates the block.
        await loadQueue(cred);
        const decision = resolvePassTurnDecision(body, nextId);
        // B2: the current song completed (§6 — never force-stopped), but the FREE daily
        // limit blocked the next start. Surface the upgrade state and update the banner
        // from server truth; the next request stays waiting/ready and we do NOT hand off.
        if (decision.kind === 'upgrade_required') {
          closePlayerOnFailure();
          if (body.usage) setUsage(body.usage);
          // BUILD 24-G1 — THIS is the screen that showed "1:50 남았어요" and "모두 사용했어요"
          // at the same time. `upgrade_required` is raised for the whole predicate
          // `charge > remaining`, so it covers both exhaustion AND "you have time, but not
          // enough for this song". The wording now comes from the authority's own numbers.
          // Prefer the published admission detail; fall back to the usage projection, which
          // carries remainingSeconds on this path too.
          setError(
            upgradeRequiredCopy({
              remainingSeconds: body.remainingSeconds ?? body.usage?.remainingSeconds,
              requiredChargeSeconds: body.requiredChargeSeconds,
              durationSeconds: body.durationSeconds,
            }),
          );
          return;
        }
        // BUILD 23 — the current song completed, but the NEXT one was refused fail-closed.
        // Published to the DURABLE request-keyed notice rather than `error`, which the 4s poll
        // erases within one tick — and for `too_long` / `video_unavailable` this song will never
        // become playable, so the one sentence that says so must survive. Nothing is retried,
        // removed, skipped, or reordered: the song stays waiting + Ready where the server left it.
        if (decision.kind === 'admission_block') {
          closePlayerOnFailure();
          setAdmissionBlock(decision.block);
          return;
        }
        // The next singer must actually be on stage before we command the Player.
        if (decision.kind === 'not_promoted') {
          closePlayerOnFailure();
          setError('다음 준비된 참가자를 기다리는 중이에요.');
          return;
        }
        setAdmissionBlock((prev) => clearBlockSupersededBy(prev, decision.promotedId));
      } else {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/dj/start`, {
          method: 'POST',
          headers: { ...authHeader(cred), 'content-type': 'application/json' },
          body: JSON.stringify({ requestId: nextId }),
        });
        if (res.status === 401) {
          closePlayerOnFailure();
          setPhase('disconnected');
          return;
        }
        if (!res.ok) {
          // Precise server reason (충돌/없음/종료/한도/실패) — never a generic error.
          closePlayerOnFailure();
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
            usage?: UsageProjection | null;
            /** BUILD 21 — the server's duration-block classification; absent on older payloads. */
            reason?: string;
          };
          // B2: FREE daily limit blocked this first-song start. Nothing mutated — show
          // the upgrade state and refresh the banner from the server's usage snapshot.
          if (res.status === 402 || body.code === 'upgrade_required') {
            if (body.usage) setUsage(body.usage);
          }
          // BUILD 21 — a fail-closed duration block is not transient action feedback: the song
          // stays queued and still cannot start, and for `too_long` / `video_unavailable` it
          // never will. Publish it to the request-keyed durable notice instead of `error`, so
          // the next poll or unrelated action cannot erase the one sentence that tells the Host
          // to pick a different song.
          if (res.status === 503 && body.code === 'duration_unavailable') {
            setAdmissionBlock({
              requestId: nextId,
              reason: body.reason,
              message: body.error ?? '재생 상태를 변경하지 못했습니다.',
            });
            return;
          }
          setError(body?.error ?? '재생 상태를 변경하지 못했습니다.');
          return;
        }
        // Success for THIS request supersedes any block it previously carried. Another
        // request's block is deliberately left alone — that song is still unplayable.
        setAdmissionBlock((prev) => (prev?.requestId === nextId ? null : prev));
        await loadQueue(cred);
      }
      // Server transition succeeded and is canonical — EXACTLY ONE lifecycle op ran above.
      // Hand off the video (best-effort UI only; never re-runs Start/pass-turn, never
      // touches the request).
      if (native) {
        // NATIVE: external YouTube app + existing TV/Cast, via the native bridge. Never
        // opens the BTY Player, never posts a channel command. Unchanged native behavior.
        if (watchUrl) nativeOpenYouTube({ videoId: nextVideoId, url: watchUrl });
      } else {
        // WEB: push the new video to the SAME Player tab over the Room BroadcastChannel; the
        // Player's canonical poll is the authority if a message is ever dropped.
        const command = buildPlayCommand(nextVideoId, nextId, null);
        if (command && typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel(playerChannelName(slug));
            ch.postMessage(command);
            ch.close();
          } catch {
            /* channel unavailable — the Player recovers via its canonical poll */
          }
        }
        // Bring the Player forward when we can; if the popup was blocked, expose an explicit
        // link to open it. The song stays exactly as the server left it either way.
        if (playerWin && !playerWin.closed) {
          try {
            playerWin.focus();
          } catch {
            /* focus may be blocked — non-fatal */
          }
        } else {
          setShowPlayerFallback(true);
        }
      }
    } catch {
      // Network error before the transition completed → never retry; close a fresh tab.
      closePlayerOnFailure();
      setError('네트워크 오류 — 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
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

  // V7 PART D — Start a New Event (Event rotation). Admin-only route: mints a new
  // Event (new id + new Guest QR) and a new night, then reloads so the console
  // leaves the ended state and shows the fresh empty queue.
  async function startNewEvent(): Promise<'ok' | 'error'> {
    if (!cred) return 'error';
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/admin/start-event`, {
        method: 'POST',
        headers: authHeader(cred),
      });
      if (res.status === 401) {
        setError('새 이벤트 시작은 Admin만 가능해요.');
        return 'error';
      }
      if (!res.ok) return 'error';
      await loadQueue(cred);
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
    <>
      {/* B2 — FREE daily-minutes banner. Server-truth only (polled + refreshed on block);
          hidden for PRO and while enforcement is disabled. Survives refresh/relaunch
          because it is reconstructed from /dj/usage, never from local countdown state. */}
      <UsageBanner usage={usage} />
      {/* BUILD 21 — the fail-closed admission block. Rendered from its OWN request-keyed state
          (never `error`, which every next action clears), so the explanation stays on screen
          while the Host decides what to do. It disappears on 확인, on a successful start of the
          SAME request, or when that request leaves the canonical queue — never on a poll. */}
      {admissionBlock && (
        <div className="banner error" role="alert" data-admission-block={admissionBlock.requestId}>
          <span style={{ whiteSpace: 'pre-line' }}>{admissionBlock.message}</span>
          <button
            className="linkish"
            style={{ marginLeft: 12 }}
            onClick={() => setAdmissionBlock(null)}
          >
            확인
          </button>
        </div>
      )}
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
        onPlayNext={playNext}
        onMoveNext={(id) => { void mutate(id, 'move_next'); }}
        onRemove={(id) => { void mutate(id, 'remove'); }}
        onReorder={reorder}
        onAddSong={addSong}
        onRefresh={refresh}
        onDisconnect={disconnectManual}
        onEndEvent={endEvent}
        onStartNewEvent={startNewEvent}
      />
      {/* Popup-blocked fallback: the song already started; the Admin stays open and the
          operator opens the same-origin Player explicitly. The link targets the SAME stable
          Player window name, so it reuses the one Player tab rather than spawning a new one.
          The Player then loads the canonical playing video via its poll. Never navigates
          Admin away, never re-runs the lifecycle. */}
      {showPlayerFallback && (
        <div
          className="yt-fallback"
          role="alert"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            padding: '14px 16px calc(14px + env(safe-area-inset-bottom))',
            background: 'rgba(10,12,20,0.96)',
          }}
        >
          <span className="muted">플레이어 탭이 자동으로 열리지 않았어요.</span>
          <a
            className="primary lg block"
            href={playerHref(slug)}
            target={playerWindowName(slug)}
            rel="noreferrer"
            onClick={() => setShowPlayerFallback(false)}
            style={{ textAlign: 'center', maxWidth: 420 }}
          >
            ▶ 플레이어 열기
          </a>
        </div>
      )}
    </>
  );
}
