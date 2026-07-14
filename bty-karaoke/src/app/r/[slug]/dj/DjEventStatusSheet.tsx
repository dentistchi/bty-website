'use client';

import { useState } from 'react';
import type { DjEventStatus } from '@/lib/events.server';
import { formatEventDuration } from '@/domain/live-presence';

interface Props {
  status: DjEventStatus;
  /** Current time (ms) for the live duration; ticked by the parent. */
  nowMs: number;
  copied: boolean;
  onShowGuestQr: () => void;
  onCopyGuestLink: () => void;
  /** Ends the whole event; resolves 'ok' once the server confirms. */
  onEndEvent: () => Promise<'ok' | 'error'>;
  onClose: () => void;
}

// Compact, operational Event Status sheet (bottom sheet on phone, side sheet on
// iPad). Reads all numbers from the DJ payload — no stats/ordering recomputed
// here. End Event is a manager-grade action, clearly separate from "Disconnect
// this iPad", guarded by an inline confirmation.
export default function DjEventStatusSheet({
  status,
  nowMs,
  copied,
  onShowGuestQr,
  onCopyGuestLink,
  onEndEvent,
  onClose,
}: Props) {
  const [confirm, setConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = status.status === 'active';
  const duration = formatEventDuration(status.startsAt, nowMs);

  async function doEnd() {
    setEnding(true);
    setError(null);
    const r = await onEndEvent();
    setEnding(false);
    if (r === 'ok') setConfirm(false);
    else setError('Could not end the event. Try again.');
  }

  return (
    <div className="event-sheet-backdrop" onClick={onClose}>
      <aside
        className="event-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Event status"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-sheet-head">
          <div className="eyebrow">Event Status</div>
          <button className="event-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="display-sm">{status.name}</div>
        <div className="lead" style={{ marginTop: 2 }}>
          {active ? `Live for ${duration}` : 'Event ended · history preserved'}
        </div>

        <div className="event-stat-grid">
          <div className="event-stat">
            <div className="n">{status.counts.guests}</div>
            <div className="k">Guests</div>
          </div>
          <div className="event-stat">
            <div className="n">{status.counts.requests}</div>
            <div className="k">Requests</div>
          </div>
          <div className="event-stat">
            <div className="n">{status.counts.completed}</div>
            <div className="k">Completed</div>
          </div>
          <div className="event-stat">
            <div className="n">{status.counts.waiting}</div>
            <div className="k">Waiting</div>
          </div>
        </div>

        {status.nowPlaying && (
          <div className="event-line">
            <span className="event-line-label gold">Now Singing</span>
            {status.nowPlaying.title} · {status.nowPlaying.guestName}
          </div>
        )}
        {status.upNext && (
          <div className="event-line">
            <span className="event-line-label cyan">Up Next</span>
            {status.upNext.title} · {status.upNext.guestName}
          </div>
        )}

        <div className="stack" style={{ marginTop: 16 }}>
          <button className="cyan block" onClick={onShowGuestQr}>
            Show Guest QR
          </button>
          <button className="ghost block" onClick={onCopyGuestLink}>
            {copied ? 'Copied!' : 'Copy Guest Link'}
          </button>
        </div>

        {active && (
          <div className="event-end-zone">
            {confirm ? (
              <div className="card" style={{ borderColor: 'rgba(255, 92, 124, 0.45)', margin: 0 }}>
                <div className="d-name">End {status.name}?</div>
                <p className="lead" style={{ marginTop: 6 }}>
                  New song requests will stop. The current queue and event history will stay. The
                  song playing on YouTube will not be stopped.
                </p>
                {error && <div className="banner error" style={{ marginTop: 8 }}>{error}</div>}
                <div className="stack" style={{ marginTop: 12 }}>
                  <button className="ghost block" disabled={ending} onClick={() => setConfirm(false)}>
                    Keep Event Live
                  </button>
                  <button className="danger block" disabled={ending} onClick={doEnd}>
                    {ending ? 'Ending…' : 'End Event'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="danger block" onClick={() => setConfirm(true)}>
                End Event
              </button>
            )}
            <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
              Ending the event is different from “Disconnect this iPad”.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
