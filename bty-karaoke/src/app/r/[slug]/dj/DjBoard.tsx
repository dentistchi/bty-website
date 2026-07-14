'use client';

import { useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import type { DjEventStatus } from '@/lib/events.server';
import { selectStage } from '@/domain/queue';
import { primaryPlayTarget, runPlayOnTv } from '@/domain/play-flow';
import { requestDisplayTitle } from '@/domain/request-view';
import { displaySong } from '@/domain/song-title';
import { formatEventDuration } from '@/domain/live-presence';
import { youtubeWatchUrl } from '@/domain/youtube-search';
import DjActionSheet from './DjActionSheet';
import DjAdminMenu from './DjAdminMenu';
import DjEventStatusSheet from './DjEventStatusSheet';

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
  eventStatus: DjEventStatus | null;
}

interface Props {
  slug: string;
  displayName: string;
  data: QueuePayload | null;
  newIds: string[];
  reconnecting: boolean;
  busy: boolean;
  error: string | null;
  dev?: boolean;
  /** Admin-capable bearer, present only when the authenticated role is admin. */
  adminCred?: string | null;
  onStart: (id: string) => void | Promise<void>;
  onFinish: (id: string) => void | Promise<void>;
  onMoveNext: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onDisconnect: () => void;
  /** Ends the whole event (distinct from Disconnect); resolves 'ok' on success. */
  onEndEvent: () => Promise<'ok' | 'error'>;
}

export default function DjBoard({
  slug,
  displayName,
  data,
  newIds,
  reconnecting,
  busy,
  error,
  adminCred,
  onStart,
  onFinish,
  onMoveNext,
  onRemove,
  onRefresh,
  onDisconnect,
  onEndEvent,
}: Props) {
  const [guestQr, setGuestQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [sheetFor, setSheetFor] = useState<KaraokeRequest | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nowMs, setNowMs] = useState(() => 0);
  // Re-entry guard so rapid taps can't open two tabs or fire two play mutations.
  const startingRef = useRef(false);

  const requests = data?.requests ?? [];
  const { current, queue } = selectStage(requests);
  const live = Boolean(data?.session);
  const eventStatus = data?.eventStatus ?? null;
  const durationLabel = eventStatus ? formatEventDuration(eventStatus.startsAt, nowMs || Date.now()) : '';

  // Tick a coarse clock (30s) so the header/sheet duration stays current while a
  // live event is open. Only runs when there IS a live event.
  useEffect(() => {
    if (!eventStatus || eventStatus.status !== 'active') return;
    setNowMs(Date.now());
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [eventStatus]);

  async function copyGuestLink() {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      await navigator.clipboard.writeText(d.url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      /* clipboard blocked — Show Guest QR still works */
    }
  }
  const newSet = new Set(newIds);
  const isAdmin = data?.role === 'admin';
  // The single "▶ Play on TV" target: the first waiting song, only while the
  // stage is open. Null once a song is playing (finish it first — no swap).
  const playTarget = primaryPlayTarget(current, queue);

  // Navigate THIS Safari tab to the video (not window.open). On iPad this hands
  // off to the YouTube app without leaving a blank Safari window behind; the DJ
  // returns to the console with the browser Back gesture.
  function openVideo(videoId: string) {
    window.location.assign(youtubeWatchUrl(videoId));
  }

  // One-tap play: commit waiting→playing FIRST, then navigate this tab to
  // YouTube (navigating away would abort the in-flight mutation, so it must land
  // first). Idempotent under repeated taps; on mutation failure the error banner
  // shows, we do NOT leave for YouTube, and the song stays waiting for a retry.
  function playOnTv(r: KaraokeRequest) {
    if (busy || startingRef.current) return;
    startingRef.current = true;
    void runPlayOnTv({
      play: () => onStart(r.id),
      openVideo: () => openVideo(r.youtube_video_id),
    }).finally(() => {
      startingRef.current = false;
    });
  }

  async function showGuestQr() {
    setLoadingQr(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/guest-qr`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setGuestQr({ qrSvg: d.qrSvg, url: d.url });
      }
    } finally {
      setLoadingQr(false);
    }
  }

  // Awareness/navigation only: jump to the earliest still-highlighted new song
  // in its REAL queue position. Never reorders — the card does not move.
  function goToFirstNew() {
    const target = queue.find((r) => newSet.has(r.id));
    if (!target) return;
    document
      .getElementById(`req-${target.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <main className="dj-console">
      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="statusbar" role="banner">
        {eventStatus ? (
          <button
            type="button"
            className="sb-event"
            aria-haspopup="dialog"
            aria-label={`Event status for ${displayName}`}
            onClick={() => setStatusOpen(true)}
          >
            <span className="sb-room">{displayName}</span>
            {eventStatus.status !== 'active' ? (
              <span className="pill">Ended</span>
            ) : (
              <span className="pill live">
                <span className="live-dot" aria-hidden />
                {live ? `LIVE · ${durationLabel}` : 'Paused'}
              </span>
            )}
            <span className="sb-chevron" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <>
            <span className="sb-room">{displayName}</span>
            {live ? (
              <span className="pill live">
                <span className="live-dot" aria-hidden />
                LIVE
              </span>
            ) : (
              <span className="pill">Paused</span>
            )}
          </>
        )}
        <span className="sb-sep" aria-hidden />
        <span className="sb-metric">
          <b>{data?.stats.guests ?? 0}</b> singers
        </span>
        <span className="sb-metric">
          <b>{data?.stats.requests ?? 0}</b> requests
        </span>
        <span className="grow" />
        {newIds.length > 0 && (
          <button
            type="button"
            className="new-chip"
            aria-live="polite"
            onClick={goToFirstNew}
            title="Jump to the newest song"
          >
            🎵 {newIds.length} new
          </button>
        )}
        <span className="sb-metric" title="This iPad is a connected DJ">
          <span className="status-dot ok" aria-hidden /> DJ connected
        </span>
        {isAdmin && (
          <button
            type="button"
            className="admin-trigger"
            aria-haspopup="dialog"
            onClick={() => setAdminOpen(true)}
          >
            ⋯ Admin
          </button>
        )}
      </div>

      {reconnecting && (
        <div className="reconnecting" role="status">
          <span className="status-dot warn" aria-hidden />
          Reconnecting… your queue is safe.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <div className="dj-grid">
        {/* ── LEFT: NOW SINGING stage ──────────────────────────── */}
        <section className="dj-stage" aria-label="Now singing">
          {current ? (
            <div className="stage-hero stage-slide" key={current.id}>
              <div className="eyebrow" style={{ color: 'var(--magenta)' }}>
                Now singing
              </div>
              {current.youtube_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stage-thumb"
                  src={current.youtube_thumbnail_url}
                  alt=""
                  style={{ marginTop: 12 }}
                />
              ) : (
                <div className="stage-thumb ph" style={{ marginTop: 12 }} aria-hidden>
                  🎤
                </div>
              )}
              <div className="stage-req strong">{current.guest_name}</div>
              {(() => {
                const d = displaySong(current.youtube_title ?? '', current.youtube_channel_title);
                return (
                  <>
                    <div className="stage-title">{d.song || requestDisplayTitle(current)}</div>
                    {d.artist && <div className="stage-artist">{d.artist}</div>}
                  </>
                );
              })()}
              <div className="stage-actions">
                <button className="cyan lg" onClick={() => openVideo(current.youtube_video_id)}>
                  Open in YouTube
                </button>
                <button className="ok lg" disabled={busy} onClick={() => onFinish(current.id)}>
                  ✓ Finish song
                </button>
              </div>
            </div>
          ) : playTarget ? (
            <div className="stage-hero ready" key={playTarget.id}>
              <div className="eyebrow">Up first</div>
              {playTarget.youtube_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stage-thumb"
                  src={playTarget.youtube_thumbnail_url}
                  alt=""
                  style={{ marginTop: 12 }}
                />
              ) : (
                <div className="stage-thumb ph" style={{ marginTop: 12 }} aria-hidden>
                  🎤
                </div>
              )}
              <div className="stage-req strong">{playTarget.guest_name}</div>
              {(() => {
                const d = displaySong(playTarget.youtube_title ?? '', playTarget.youtube_channel_title);
                return (
                  <>
                    <div className="stage-title">{d.song || requestDisplayTitle(playTarget)}</div>
                    {d.artist && <div className="stage-artist">{d.artist}</div>}
                  </>
                );
              })()}
              <p className="lead">Opens the video, then puts this song on stage.</p>
              <div className="stage-actions">
                <button className="primary lg" disabled={busy} onClick={() => playOnTv(playTarget)}>
                  ▶ Play on TV
                </button>
              </div>
            </div>
          ) : (
            <div className="stage-hero ready">
              <div className="eyebrow">The queue is open</div>
              <div className="stage-title" style={{ marginTop: 10 }}>
                Invite the room
              </div>
              <p className="lead">Share the guest QR and let everyone line up the first song.</p>
              <div className="stage-actions">
                <button className="primary lg" disabled={loadingQr} onClick={showGuestQr}>
                  {loadingQr ? 'Opening…' : 'Show guest QR'}
                </button>
              </div>
            </div>
          )}

          {/* Room controls under the stage */}
          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <button className="ghost" disabled={loadingQr} onClick={showGuestQr}>
              Invite singers
            </button>
            <div className="row">
              <button className="linkish" onClick={() => onRefresh()}>
                Refresh
              </button>
              {!isAdmin && (
                <button className="linkish" onClick={onDisconnect}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── RIGHT: UP NEXT ───────────────────────────────────── */}
        <section className="dj-queue" aria-label="Up next">
          <div className="dj-col-title">
            <span className="eyebrow">Up next</span>
            <span className="muted">{queue.length}</span>
          </div>

          {queue.length === 0 ? (
            <div className="card empty">
              <div className="display-sm">No requests yet</div>
              <p className="lead">Share the guest QR and let the room choose the music.</p>
              <button
                className="cyan"
                style={{ marginTop: 12 }}
                disabled={loadingQr}
                onClick={showGuestQr}
              >
                Show guest QR
              </button>
            </div>
          ) : (
            queue.map((r, i) => {
              const isNew = newSet.has(r.id);
              const d = displaySong(r.youtube_title ?? '', r.youtube_channel_title);
              const song = d.song || requestDisplayTitle(r);
              return (
                <div
                  id={`req-${r.id}`}
                  className={`q-card singer-first${i === 0 ? ' head' : ''}${isNew ? ' isnew stage-slide' : ''}`}
                  key={r.id}
                >
                  <span className="q-pos">{String(i + 1).padStart(2, '0')}</span>
                  <div className="q-main">
                    <div className="q-singer">
                      {isNew && <span className="new-badge">✨ NEW</span>}
                      {r.guest_name}
                    </div>
                    <div className="q-song">{song}</div>
                    {d.artist && <div className="q-artist">{d.artist}</div>}
                  </div>
                  <div className="q-actions">
                    <button
                      className="q-overflow"
                      aria-label={`${r.guest_name}님의 신청곡 ${song}${d.artist ? ` — ${d.artist}` : ''} 관리`}
                      aria-haspopup="dialog"
                      onClick={() => setSheetFor(r)}
                    >
                      ⋯
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* ── Full-screen guest QR overlay ─────────────────────────── */}
      {guestQr && (
        <div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Guest song-request QR">
          <div>
            <div className="eyebrow">Request a song</div>
            <div className="display-sm" style={{ margin: '6px 0 14px' }}>
              Scan to join {displayName}
            </div>
            <div className="qr-surface" dangerouslySetInnerHTML={{ __html: guestQr.qrSvg }} />
            <div className="qr-caption">{data?.stats.guests ?? 0} singers joined</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="ghost" onClick={() => setGuestQr(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Status sheet (tap the event header) ────────────────── */}
      {statusOpen && eventStatus && (
        <DjEventStatusSheet
          status={eventStatus}
          nowMs={nowMs || Date.now()}
          copied={copiedLink}
          onShowGuestQr={() => {
            setStatusOpen(false);
            void showGuestQr();
          }}
          onCopyGuestLink={copyGuestLink}
          onEndEvent={onEndEvent}
          onClose={() => setStatusOpen(false)}
        />
      )}

      {/* ── Admin menu (admin role only; secondary to the live surface) ─ */}
      {isAdmin && adminOpen && adminCred && (
        <DjAdminMenu
          slug={slug}
          displayName={displayName}
          cred={adminCred}
          onShowGuestQr={showGuestQr}
          onSessionEnded={() => onRefresh()}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {/* ── Custom queue action sheet (replaces window.confirm) ──── */}
      {sheetFor && (
        <DjActionSheet
          request={sheetFor}
          busy={busy}
          onMoveNext={(id) => {
            void onMoveNext(id);
            setSheetFor(null);
          }}
          onRemove={(id) => {
            void onRemove(id);
            setSheetFor(null);
          }}
          onClose={() => setSheetFor(null)}
        />
      )}
    </main>
  );
}
