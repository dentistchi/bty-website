'use client';

import { useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import type { KaraokeSession } from '@/lib/sessions.server';
import { selectStage } from '@/domain/queue';
import { requestDisplayTitle } from '@/domain/request-view';
import { youtubeWatchUrl } from '@/domain/youtube-search';

interface QueuePayload {
  room: { display_name: string; status: 'open' | 'closed' };
  role: 'dj' | 'admin';
  session: KaraokeSession | null;
  stats: { requests: number; guests: number };
  requests: KaraokeRequest[];
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
  onStart: (id: string) => void | Promise<void>;
  onFinish: (id: string) => void | Promise<void>;
  onSkip: (id: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onDisconnect: () => void;
}

export default function DjBoard({
  slug,
  displayName,
  data,
  newIds,
  reconnecting,
  busy,
  error,
  onStart,
  onFinish,
  onSkip,
  onRefresh,
  onDisconnect,
}: Props) {
  const [guestQr, setGuestQr] = useState<{ qrSvg: string; url: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const requests = data?.requests ?? [];
  const { current, queue } = selectStage(requests);
  const live = Boolean(data?.session);
  const stageOpen = !current;
  const newSet = new Set(newIds);

  function openVideo(videoId: string) {
    window.open(youtubeWatchUrl(videoId), '_blank', 'noopener');
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

  function confirmSkip(id: string, title: string) {
    if (window.confirm(`Remove “${title}” from the queue?`)) void onSkip(id);
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
        <span className="sb-room">{displayName}</span>
        {live ? (
          <span className="pill live">
            <span className="live-dot" aria-hidden />
            LIVE
          </span>
        ) : (
          <span className="pill">Paused</span>
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
              <div className="stage-title">{requestDisplayTitle(current)}</div>
              {current.youtube_channel_title && (
                <div className="stage-artist">{current.youtube_channel_title}</div>
              )}
              <div className="stage-req">Requested by {current.guest_name}</div>
              <div className="stage-actions">
                <button className="cyan lg" onClick={() => openVideo(current.youtube_video_id)}>
                  Open in YouTube
                </button>
                <button className="ok lg" disabled={busy} onClick={() => onFinish(current.id)}>
                  Finish song · Next
                </button>
              </div>
            </div>
          ) : queue.length > 0 ? (
            <div className="stage-hero ready">
              <div className="eyebrow">The stage is ready</div>
              <div className="stage-title" style={{ marginTop: 10 }}>
                Start the night
              </div>
              <p className="lead">Choose the first song and put it on stage.</p>
              <div className="stage-actions">
                <button className="primary lg" disabled={busy} onClick={() => onStart(queue[0].id)}>
                  Start “{requestDisplayTitle(queue[0])}”
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
              <button className="linkish" onClick={onDisconnect}>
                Disconnect
              </button>
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
              const title = requestDisplayTitle(r);
              return (
                <div
                  id={`req-${r.id}`}
                  className={`q-card${i === 0 ? ' head' : ''}${isNew ? ' isnew stage-slide' : ''}`}
                  key={r.id}
                >
                  <span
                    className="drag-affordance"
                    aria-hidden
                    title="Reorder (coming soon)"
                  >
                    ⠿
                  </span>
                  <span className="q-pos">{String(i + 1).padStart(2, '0')}</span>
                  <div className="q-main">
                    <div className="q-title">
                      {isNew && <span className="new-badge">✨ NEW</span>}
                      {title}
                    </div>
                    <div className="q-sub">
                      {r.youtube_channel_title ? `${r.youtube_channel_title} · ` : ''}
                      {r.guest_name}
                    </div>
                  </div>
                  <div className="q-actions">
                    {stageOpen && (
                      <button className="primary q-start" disabled={busy} onClick={() => onStart(r.id)}>
                        Start
                      </button>
                    )}
                    <button
                      className="q-overflow"
                      aria-label={`Remove ${title}`}
                      onClick={() => confirmSkip(r.id, title)}
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
    </main>
  );
}
