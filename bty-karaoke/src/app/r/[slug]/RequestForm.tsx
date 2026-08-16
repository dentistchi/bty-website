'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import {
  resolveSubmit,
  submitCopy,
  submitStatusCopy,
  type SubmitPhase,
  type SubmitErrorClass,
} from '@/domain/request-submit';
import { rankResults, rankSearchResults, isMrCandidate } from '@/domain/youtube-rank';
import {
  type PerformanceStyle,
  PERFORMANCE_STYLES,
  DEFAULT_STYLE,
  styleCopy,
} from '@/domain/performance-style';
import { guestNameKey, normalizeGuestName, isValidGuestName } from '@/domain/guest-identity';
import { useGuestLocale } from '@/components/guest/GuestLocaleProvider';
import {
  myRequestsKey,
  legacyMyRequestsKey,
  pruneMyRequests,
  addMyRequest,
  type MyRequest,
} from '@/domain/guest-requests';
import RequestResultCard from './RequestResultCard';
import GuestDiagnosticPanel from './GuestDiagnosticPanel';
import DevelopedWithYouTube from '@/components/youtube/DevelopedWithYouTube';
import MyRequestsDock from './MyRequestsDock';
import RecentlySungSection from './RecentlySungSection';
import AppInvitationCard from './AppInvitationCard';
import PersistentAppEntry from './PersistentAppEntry';
import { useRecentlySung } from './recently-sung.hooks';
import {
  inviteShownKey,
  appUrlKey,
  persistentCtaShownKey,
  resolvePersistentCta,
  type GuestFunnelEvent,
} from '@/domain/app-invite';
import { roomNavIdentifier } from '@/domain/guest-handoff';
import { canonicalUniversalLink } from '@/domain/app-link';

interface Props {
  slug: string;
  roomOpen: boolean;
  /** The room's canonical live event id, or null (namespaces ownership storage). */
  eventId?: string | null;
  /**
   * Optional: fired after a request is successfully submitted. The event guest
   * screen uses it to refresh live presence immediately; legacy callers omit it
   * (no behavior change).
   */
  onSubmitted?: () => void;
}

type SearchState = 'idle' | 'searching' | 'done';

/**
 * BUILD 20M-WEB8 — the RETIRED anonymous saved-song key from BUILD 20B-WEB7. Declared here only
 * so the obsolete entry can be deleted on Guest init; no code path ever reads its contents, so a
 * stale value on an existing device can never restore removed UI.
 */
const LEGACY_SAVED_SONGS_KEY = 'bty-karaoke:saved-songs';

export default function RequestForm({ slug, roomOpen, eventId = null, onSubmitted }: Props) {
  const { locale, t } = useGuestLocale();
  // Identity — remembered once per room/device (never authentication).
  const [guestName, setGuestName] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [editingName, setEditingName] = useState(true);

  const [query, setQuery] = useState('');
  // Performance Style: MR is the default (Dr. Chi's preference — clean backing
  // tracks). Karaoke biases toward on-screen-words videos; Original is the raw
  // query. Changing style re-runs the search with the same query.
  const [style, setStyle] = useState<PerformanceStyle>(DEFAULT_STYLE);
  const [results, setResults] = useState<YoutubeSearchItem[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [recos, setRecos] = useState<YoutubeSearchItem[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // BUILD 19C — the contextual, non-blocking app invitation (shown at most once per guest
  // session/Event after the first successful request; reuses the BUILD 19B handoff).
  const [appInvite, setAppInvite] = useState<{ url: string; handoffId: string; requestId: string } | null>(null);

  // BUILD 19C — the PERSISTENT app-entry CTA (always under the hero). Holds the minted Universal
  // Link once a request exists; persisted per room+event so it stays ACTIVE across reloads within
  // the Event (a handoff replay does not re-emit the link). Independent of the one-time card above.
  const [persistentApp, setPersistentApp] = useState<{ url: string; handoffId: string | null } | null>(null);

  // BUILD 18B — the submit state machine + failure classification (server drives it via
  // stable `code`s; the view only renders). `activeSubmission` holds the CURRENT logical
  // request with its STABLE idempotency key — reused on every retry so a timeout/lost
  // response can never create a duplicate queue row (the server replays the same row).
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
  const [submitErrorClass, setSubmitErrorClass] = useState<SubmitErrorClass | null>(null);
  const activeSubmission = useRef<{
    logicalKey: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    displayTitle: string;
    displayArtist: string | null;
  } | null>(null);
  // A client abort past this point makes the result UNCERTAIN (not failed): the server
  // may have committed. The retry reuses the key so the server replays, never duplicates.
  const SUBMIT_TIMEOUT_MS = 12000;

  // Every request this device submitted (presentation only — statuses come from
  // the server resolver). Persisted per room so a reload keeps continuity.
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);

  const recentlySung = useRecentlySung(slug, eventId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // BUILD 20M-WEB8 — retire the BUILD 20B-WEB7 anonymous saved-song library. Nothing reads
    // this key any more, so drop the one obsolete entry on Guest init. Scoped to EXACTLY that
    // key: no other localStorage (guest name, my-requests, recently sung, app-entry) is touched.
    try {
      window.localStorage.removeItem(LEGACY_SAVED_SONGS_KEY);
    } catch {
      /* storage disabled — nothing reads the key regardless */
    }
    const savedName = window.localStorage.getItem(guestNameKey(slug));
    if (savedName && isValidGuestName(savedName)) {
      setGuestName(normalizeGuestName(savedName));
      setNameLocked(true);
      setEditingName(false);
    }
    try {
      const key = myRequestsKey(slug, eventId);
      let raw = window.localStorage.getItem(key);
      // Transition (V5): when this room now has an event, adopt the guest's
      // legacy room-scoped list ONCE into the event-scoped key. Same room, same
      // in-flight requests, same still-valid capabilities → safe to carry into
      // the FIRST event. A different eventId always yields a different key, so a
      // later event can never inherit a prior event's requests.
      if (!raw && eventId) {
        const legacy = window.localStorage.getItem(legacyMyRequestsKey(slug));
        if (legacy) {
          window.localStorage.setItem(key, legacy);
          raw = legacy;
        }
      }
      if (raw) setMyRequests(pruneMyRequests(JSON.parse(raw) as MyRequest[], Date.now()));
    } catch {
      /* ignore corrupt storage */
    }
    // Rehydrate the persistent app-entry link (kept ACTIVE across reloads within the Event).
    try {
      const rawUrl = window.localStorage.getItem(appUrlKey(slug, eventId));
      if (rawUrl) {
        const parsed = JSON.parse(rawUrl) as { url?: string; handoffId?: string | null };
        if (parsed?.url) setPersistentApp({ url: parsed.url, handoffId: parsed.handoffId ?? null });
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [slug, eventId]);

  // FUNCTIONAL update: always fold into the LATEST tracker, never a closure snapshot.
  // A non-functional `persistRequests(addMyRequest(myRequests, …))` captured a stale
  // `myRequests` — so a request added between render and this call (e.g. 다시 신청
  // right after a poll) was silently dropped, leaving 내 신청곡 0. Folding on `prev`
  // guarantees the new owned request is registered and survives concurrent writes.
  function persistRequests(update: (prev: MyRequest[]) => MyRequest[]) {
    setMyRequests((prev) => {
      const next = update(prev);
      try {
        window.localStorage.setItem(myRequestsKey(slug, eventId), JSON.stringify(next));
      } catch {
        /* storage full / disabled — presentation only */
      }
      return next;
    });
  }

  const removeMyRequest = (requestId: string) =>
    persistRequests((prev) => prev.filter((r) => r.requestId !== requestId));

  // "다시 신청" — submit a NEW request for a completed song's same media. Reuses the
  // canonical submit (one-in-flight dedupe → rapid taps create at most one). The
  // completed history record is immutable; this never mutates it back to waiting.
  const reRequest = (row: MyRequest) => {
    if (!row.videoId) return;
    void submit(
      {
        youtubeVideoId: row.videoId,
        ...(row.title ? { youtubeTitle: row.title } : {}),
        ...(row.artist ? { youtubeChannelTitle: row.artist } : {}),
      },
      row.title,
      row.artist,
      `re:${row.requestId}`,
    );
  };

  // Mode-aware ranking (V5.2): the chosen style decides order, so MR mode leads
  // with real MR/instrumental results instead of popular karaoke videos.
  const ranked = useMemo(
    () => rankSearchResults(results, { style, query: resultQuery }),
    [results, resultQuery, style],
  );
  // Honest fallback: in MR mode with results but no MR candidate, say so without
  // hiding the (karaoke/original) results we did find.
  const noMrFound = useMemo(
    () => style === 'mr' && results.length > 0 && !results.some(isMrCandidate),
    [style, results],
  );

  async function runSearch(e: React.FormEvent | null, mode: PerformanceStyle = style) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setError(null);
    // A new search moves on from any prior submit status (retry button hides).
    if (!submittingKey) {
      setSubmitPhase('idle');
      setSubmitErrorClass(null);
    }
    setSearchState('searching');
    setResults([]);
    setRecos([]);
    setShowMore(false);
    setFallbackUrl(null);
    setSearchNote(null);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query.trim())}&style=${mode}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t('guest.search.failed'));
        setSearchState('idle');
        return;
      }
      const items: YoutubeSearchItem[] = data.items ?? [];
      setResults(items);
      setResultQuery(query.trim());
      setFallbackUrl(data.fallbackUrl ?? null);
      if (data.gated) setSearchNote(t('guest.search.warming_up'));
      // Daily YouTube search quota exhausted — honest, distinct from a temporary blip.
      else if (data.quotaExceeded) setSearchNote(t('guest.search.quota'));
      // Temporary upstream/network failure (5xx/timeout) — a busy moment, not a dead end.
      else if (data.degraded) setSearchNote(t('guest.search.busy'));
      else if (items.length === 0) setSearchNote(t('guest.search.no_results'));
      setSearchState('done');
      void loadRecommendations(items, query.trim());
    } catch {
      setError(t('guest.search.network_error'));
      setSearchState('idle');
    }
  }

  async function loadRecommendations(items: YoutubeSearchItem[], q: string) {
    const top = rankResults(items, q).top[0];
    if (!top) return;
    try {
      const url = `/api/youtube/recommend?title=${encodeURIComponent(top.title)}&channel=${encodeURIComponent(
        top.channelTitle,
      )}&videoId=${encodeURIComponent(top.videoId)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setRecos((data.items ?? []).filter((r: YoutubeSearchItem) => r.videoId !== top.videoId));
    } catch {
      /* recommendations are optional */
    }
  }

  // BUILD 18B Gate C fix — the DURABLE idempotency key for one logical request. It lives in
  // sessionStorage (per room+event+song) so it survives a rerender, a component remount, a
  // browser reconnect, AND whether the user retries via the retry button OR by re-tapping
  // the same song card. A NEW key is minted ONLY when none is stored — i.e. a genuinely new
  // song, or the same song AFTER a confirmed success / non-retryable failure cleared it.
  const pendingKeyStore = (logicalKey: string) => `bty:reqkey:${slug}:${eventId ?? ''}:${logicalKey}`;
  function acquireIdempotencyKey(logicalKey: string): string {
    try {
      const sk = pendingKeyStore(logicalKey);
      const existing = window.sessionStorage.getItem(sk);
      if (existing) return existing; // an unresolved attempt for THIS song → reuse, never duplicate
      const fresh = crypto.randomUUID();
      window.sessionStorage.setItem(sk, fresh);
      return fresh;
    } catch {
      return crypto.randomUUID(); // storage disabled — the in-memory ref still reuses within this mount
    }
  }
  function clearPendingKey(logicalKey: string) {
    try {
      window.sessionStorage.removeItem(pendingKeyStore(logicalKey));
    } catch {
      /* ignore */
    }
  }

  // Begin (or re-tap) a logical song request. Reuses the durable key for the SAME song
  // while it is unresolved; mints a fresh key only for a genuinely new/different request.
  function submit(
    payload: Record<string, unknown>,
    displayTitle: string,
    displayArtist: string | null,
    key: string,
  ) {
    if (submittingKey) return; // one in-flight request at a time (double-tap dedupe)
    const name = normalizeGuestName(guestName);
    if (!isValidGuestName(name)) {
      setEditingName(true);
      setError(t('guest.name.required'));
      return;
    }
    activeSubmission.current = {
      logicalKey: key,
      idempotencyKey: acquireIdempotencyKey(key), // reuse the durable key for this logical request
      payload,
      displayTitle,
      displayArtist,
    };
    void doSubmit();
  }

  // Retry the CURRENT logical request — REUSES its idempotency key so the server replays
  // an already-committed insert instead of duplicating it. Offered only for retryable /
  // uncertain phases (the button is hidden otherwise).
  function retrySubmit() {
    if (submittingKey || !activeSubmission.current) return;
    void doSubmit();
  }

  async function doSubmit() {
    const sub = activeSubmission.current;
    if (!sub) return;
    const name = normalizeGuestName(guestName);
    setSubmittingKey(sub.logicalKey);
    setSubmitPhase('submitting');
    setSubmitErrorClass(null);
    setError(null);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        // V7 PART E: echo the Event this screen is scoped to so the server can reject a
        // previous round's QR (EVENT_MISMATCH) or an ended one (EVENT_ENDED). BUILD 18B:
        // the stable idempotencyKey makes the insert replay-safe under retry.
        body: JSON.stringify({
          guestName: name,
          searchQuery: resultQuery || undefined,
          ...(eventId ? { eventId } : {}),
          idempotencyKey: sub.idempotencyKey,
          ...sub.payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const resolution = resolveSubmit({ status: res.status, code: data?.code });
      if (resolution.phase === 'succeeded') {
        onSubmitSuccess(data, sub, name);
        return;
      }
      setSubmitPhase(resolution.phase);
      setSubmitErrorClass(resolution.errorClass);
      // A non-retryable failure ends this logical request — clear the durable key so a
      // later attempt mints a fresh one (incl. idempotency_conflict, so a new key can succeed).
      if (resolution.phase === 'failed_nonretryable') {
        clearPendingKey(sub.logicalKey);
        activeSubmission.current = null;
      }
    } catch (e) {
      // Aborted by our timeout → UNCERTAIN (server may have committed). Any other throw is
      // an offline/transport failure. Both KEEP activeSubmission so a retry reuses the key.
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      const resolution = resolveSubmit(aborted ? { aborted: true } : { networkError: true });
      setSubmitPhase(resolution.phase);
      setSubmitErrorClass(resolution.errorClass);
    } finally {
      window.clearTimeout(timer);
      setSubmittingKey(null);
    }
  }

  function onSubmitSuccess(
    data: { request?: Record<string, unknown>; cancelToken?: string | null },
    sub: { logicalKey: string; displayTitle: string; displayArtist: string | null },
    name: string,
  ) {
    window.localStorage.setItem(guestNameKey(slug), name);
    setGuestName(name);
    setNameLocked(true);
    setEditingName(false);

    const req = data.request ?? {};
    // Register the owned request on the LATEST tracker (addMyRequest dedups by requestId,
    // so a replay of the SAME row never creates a second tile). Keep search/results as-is.
    persistRequests((prev) =>
      addMyRequest(prev, {
        requestId: String(req.id),
        cancelToken: data.cancelToken ?? null,
        title: (req.youtube_title as string) ?? (req.search_query as string) ?? sub.displayTitle,
        artist: (req.youtube_channel_title as string) ?? sub.displayArtist,
        videoId: (req.youtube_video_id as string) ?? null,
        submittedAt: Date.now(),
      }),
    );
    setSubmitPhase('succeeded');
    setSubmitErrorClass(null);
    clearPendingKey(sub.logicalKey); // confirmed success → the next request for this song is genuinely new
    activeSubmission.current = null;
    // Brief "✓ 신청됨" on the card that was submitted.
    setRequestedIds((prev) => [...prev, sub.logicalKey]);
    window.setTimeout(() => setRequestedIds((prev) => prev.filter((k) => k !== sub.logicalKey)), 2500);
    onSubmitted?.(); // event guest screen refreshes live presence immediately
    void maybeShowAppInvite(String(req.id)); // BUILD 19C — contextual app invitation after success
  }

  // BUILD 19C — best-effort, privacy-clean funnel analytics (fire-and-forget). Never blocks the
  // guest flow; the server records the event type + already-public ids only (no token/identity).
  function recordFunnel(eventType: GuestFunnelEvent, handoffId?: string, requestId?: string) {
    try {
      void fetch('/api/guest-app-funnel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ eventType, roomSlug: slug, ...(handoffId ? { handoffId } : {}), ...(requestId ? { requestId } : {}) }),
      });
    } catch {
      /* best-effort */
    }
  }

  // Mint (or reuse) the canonical BUILD 19B handoff for a successful request and show the
  // invitation ONCE per session/Event. Idempotent: a replayed success (already shown, or no fresh
  // Universal Link returned) never re-shows or double-counts. Never blocks the request flow.
  async function maybeShowAppInvite(requestId: string) {
    if (typeof window === 'undefined' || !requestId) return;
    const inviteKey = inviteShownKey(slug, eventId);
    const oneTimeDone = !!window.localStorage.getItem(inviteKey);
    // Reliable across the stale closure right after submit: localStorage is the source of truth.
    const persistentActive = !!window.localStorage.getItem(appUrlKey(slug, eventId)) || !!persistentApp;
    if (oneTimeDone && persistentActive) return; // nothing to mint — reuse the existing handoff/link
    try {
      // Mint OR reuse the canonical BUILD 19B handoff for this successful request. Idempotent per
      // source request → never a duplicate durable handoff; the link is emitted only on first mint.
      const res = await fetch('/api/guest-app-handoffs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomSlug: slug, requestId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; handoffId?: string };

      // PERSISTENT CTA — activate once, persist the link (survives reloads), count SHOWN once.
      // Recorded SEPARATELY from the one-time invitation events (never merged).
      if (res.ok && data.url && !persistentActive) {
        const entry = { url: data.url, handoffId: data.handoffId ?? null };
        setPersistentApp(entry);
        try {
          window.localStorage.setItem(appUrlKey(slug, eventId), JSON.stringify(entry));
        } catch {
          /* presentation only */
        }
        const shownKey = persistentCtaShownKey(slug, eventId);
        if (!window.localStorage.getItem(shownKey)) {
          window.localStorage.setItem(shownKey, '1');
          recordFunnel('PERSISTENT_APP_CTA_SHOWN', data.handoffId, requestId);
        }
      }

      // ONE-TIME invitation card — unchanged: at most once per session/Event, never a broken invite.
      if (oneTimeDone) return;
      if (!res.ok || !data.url || !data.handoffId) return;
      window.localStorage.setItem(inviteKey, '1');
      setAppInvite({ url: data.url, handoffId: data.handoffId, requestId });
      recordFunnel('INVITE_SHOWN', data.handoffId, requestId);
    } catch {
      /* invitation is optional */
    }
  }

  const openAppFromInvite = () => {
    if (appInvite) recordFunnel('APP_OPEN_TAPPED', appInvite.handoffId, appInvite.requestId);
    // the <a href> then navigates to the Universal Link
  };
  const continueWebFromInvite = () => {
    if (appInvite) recordFunnel('CONTINUE_WEB', appInvite.handoffId, appInvite.requestId);
    setAppInvite(null); // dismisses ONLY the one-time card — the persistent CTA stays put
  };
  const openPersistentApp = () => {
    if (persistentApp) recordFunnel('PERSISTENT_APP_CTA_TAPPED', persistentApp.handoffId ?? undefined, undefined);
    // the <a href> then navigates to the Universal Link (safe web fallback if the app isn't installed)
  };

  const requestItem = (item: YoutubeSearchItem) =>
    submit(
      {
        youtubeVideoId: item.videoId,
        youtubeTitle: item.title,
        youtubeChannelTitle: item.channelTitle,
        ...(item.thumbnailUrl ? { youtubeThumbnailUrl: item.thumbnailUrl } : {}),
        // R3 — THIS item's own seal, carried verbatim. Never regenerated, never taken from another
        // result, and never accompanied by a client-chosen timestamp: the server derives the
        // instant from the seal alone. Absent for a legacy cache entry, which simply yields NULL
        // freshness rather than a guess.
        ...(item.youtubeProvenance ? { youtubeProvenance: item.youtubeProvenance } : {}),
      },
      item.title,
      item.channelTitle,
      item.videoId,
    );

  const requestManual = () =>
    submit({ youtubeInput: manualInput.trim() }, manualInput.trim(), null, 'manual');

  // BUILD 26H — the room-only app link.
  //
  // A QR identifies the ROOM, so opening the app is navigation and needs nothing else: no
  // name, no search, no selected song, no request, no requestId. The link is built purely
  // from the slug this page already has, so producing it performs NO fetch, mints NO
  // handoff, and writes NOTHING — the CTA is simply available from the first render.
  //
  // It requires a CURRENT live event (`eventId`), matching the public Guest surface: with no
  // live event there is nothing to join, and the resolver refuses anyway.
  //
  // The request-backed link still WINS when one exists. That preserves BUILD 19B/19C
  // behaviour exactly, including its open telemetry, for the post-request invitation path.
  const roomNavLink = eventId ? canonicalUniversalLink(roomNavIdentifier(slug) ?? '') : null;
  const appEntryLink = persistentApp?.url ?? roomNavLink;
  const persistentCta = resolvePersistentCta({ universalLink: appEntryLink });

  return (
    <>
      {/* BUILD 19C — the PERSISTENT app-entry CTA, directly under the Room hero. Informational
          before the first request; ACTIVE (canonical Universal Link) after. Never removed by
          dismissing the one-time card below; no App Store link before BUILD 19D. */}
      <PersistentAppEntry
        active={persistentCta.active}
        universalLink={appEntryLink}
        onOpen={openPersistentApp}
      />
      {/* BUILD 19C — contextual, non-blocking app invitation (App Store action hidden until 19D). */}
      {appInvite && (
        <AppInvitationCard
          universalLink={appInvite.url}
          appStoreUrl={null}
          onOpenApp={openAppFromInvite}
          onGetApp={() => appInvite && recordFunnel('APP_STORE_TAPPED', appInvite.handoffId, appInvite.requestId)}
          onContinue={continueWebFromInvite}
        />
      )}
      <div className="card">
        {error && <div className="banner error">{error}</div>}

        {/* BUILD 18B — submit status. Text always accompanies the spinner; the retry button
            appears ONLY for retryable / uncertain phases (reuses the same idempotency key). */}
        {submitPhase === 'submitting' && (
          <div className="banner" role="status" aria-live="polite">
            {submitStatusCopy(locale).submitting}
          </div>
        )}
        {submitErrorClass &&
          (submitPhase === 'failed_retryable' ||
            submitPhase === 'failed_nonretryable' ||
            submitPhase === 'uncertain') && (
            <div
              className={`banner${submitPhase === 'uncertain' ? '' : ' error'}`}
              role="alert"
              aria-live="assertive"
            >
              {submitCopy(locale, submitErrorClass)}
              {(submitPhase === 'failed_retryable' || submitPhase === 'uncertain') && (
                <button
                  type="button"
                  className="linkish"
                  style={{ marginLeft: 8 }}
                  onClick={retrySubmit}
                  disabled={submittingKey !== null}
                >
                  {submitStatusCopy(locale).retry}
                </button>
              )}
            </div>
          )}

        {/* Identity — entered once, then a compact row */}
        {nameLocked && !editingName ? (
          <div className="identity-row">
            <span className="identity-name">
              {t('guest.name.requester')} <b>{guestName}</b>
            </span>
            <button type="button" className="linkish" onClick={() => setEditingName(true)}>
              {t('guest.name.change')}
            </button>
          </div>
        ) : (
          <div className="identity-edit">
            <label htmlFor="name">{t('guest.name.label')}</label>
            <input
              id="name"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t('guest.name.placeholder')}
              maxLength={40}
            />
            {nameLocked && (
              <button
                type="button"
                className="linkish"
                onClick={() => isValidGuestName(guestName) && setEditingName(false)}
              >
                {t('guest.name.done')}
              </button>
            )}
          </div>
        )}

        {/* BUILD 20M-WEB8 — 방금 부른 노래 only. The web Guest has no saved-song library. */}
        <RecentlySungSection recentlySung={recentlySung.items} />

        <form onSubmit={runSearch}>
          <label htmlFor="q">{t('guest.search.prompt')}</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('guest.search.placeholder')}
              maxLength={100}
              autoFocus
            />
            <button type="submit" disabled={query.trim().length < 2 || searchState === 'searching'}>
              {searchState === 'searching' ? '…' : t('guest.search.action')}
            </button>
          </div>
          <div className="search-modes" role="group" aria-label={t('guest.search.style_a11y')}>
            {PERFORMANCE_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                className={`seg${style === s ? ' on' : ''}`}
                aria-pressed={style === s}
                onClick={() => {
                  setStyle(s);
                  if (query.trim().length >= 2) void runSearch(null, s);
                }}
              >
                {styleCopy(locale, s).label}
              </button>
            ))}
          </div>
          <p className="muted style-hint">{styleCopy(locale, style).hint}</p>
        </form>

        {searchNote && (
          <p className="muted" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>
            {searchNote}{' '}
            {fallbackUrl && (
              <a href={fallbackUrl} target="_blank" rel="noreferrer">
                {t('guest.search.open_youtube')}
              </a>
            )}
          </p>
        )}

        {noMrFound && (
          <p className="muted mr-fallback-note" style={{ marginTop: 10 }}>
            {t('guest.search.mr_fallback')}
          </p>
        )}

        {/* BUILD 20B-R5 — path-attribution panel, above the FIRST result. Only visible
            with ?btydiag=1; proves surface/host/build/component + raw→formatted. */}
        <GuestDiagnosticPanel sample={ranked.top[0] ?? ranked.more[0] ?? null} />

        {ranked.top.length > 0 && (
          <div className="result-group" style={{ marginTop: 12 }}>
            {/* J3 — the mark sits at the head of the list the YouTube Data API populated, so the
                attribution is adjacent to the API's presence rather than floating in a footer.
                It renders only when there are results, because with none there is no API
                presence on screen to attribute. */}
            <div className="dwyt-row">
              <DevelopedWithYouTube height={18} />
            </div>
            {ranked.top.map((r) => (
              <RequestResultCard
                key={r.videoId}
                item={r}
                onRequest={requestItem}
                pending={submittingKey === r.videoId}
                requested={requestedIds.includes(r.videoId)}
              />
            ))}

            {!showMore && ranked.more.length > 0 && (
              <button type="button" className="linkish more-results" onClick={() => setShowMore(true)}>
                {t('guest.search.show_more', { count: ranked.more.length })}
              </button>
            )}
            {showMore &&
              ranked.more.map((r) => (
                <RequestResultCard
                  key={r.videoId}
                  item={r}
                  onRequest={requestItem}
                  pending={submittingKey === r.videoId}
                  requested={requestedIds.includes(r.videoId)}
                />
              ))}
          </div>
        )}

        {recos.length > 0 && (
          <div className="reco-group">
            <div className="reco-head">{t('guest.search.recommendations')}</div>
            {recos.slice(0, 3).map((r) => (
              <RequestResultCard
                key={r.videoId}
                item={r}
                onRequest={requestItem}
                pending={submittingKey === r.videoId}
                requested={requestedIds.includes(r.videoId)}
                variant="reco"
              />
            ))}
          </div>
        )}

        <details className="fallback">
          <summary>{t('guest.search.paste_link')}</summary>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={t('guest.search.paste_placeholder')}
          />
          <button
            type="button"
            style={{ marginTop: 10 }}
            onClick={requestManual}
            disabled={!manualInput.trim() || submittingKey === 'manual'}
          >
            {submittingKey === 'manual' ? t('guest.request.cta.pending') : t('guest.search.paste_submit')}
          </button>
        </details>
      </div>

      {/* Floating live confirmation / my-requests dock */}
      <MyRequestsDock
        slug={slug}
        requests={myRequests}
        eventId={eventId}
        guestName={guestName}
        onRemoved={removeMyRequest}
        onReRequest={reRequest}
        onRecordRecentlySung={recentlySung.record}
      />
    </>
  );
}
