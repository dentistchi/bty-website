'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_NAME } from '@/lib/brand';
import { guestNameKey, normalizeGuestName, isValidGuestName } from '@/domain/guest-identity';
import type { GuestLivePresence, EventStatus } from '@/domain/live-presence';
import RequestForm from '@/app/r/[slug]/RequestForm';
import LivePresenceCard from './LivePresenceCard';

interface Props {
  guestSlug: string;
  /** Internal room slug (never shown) that backs the queue/request APIs. */
  roomSlug: string;
  eventName: string;
  hostName: string | null;
  eventStatus: EventStatus;
  initialPresence: GuestLivePresence | null;
}

const POLL_MS = 4000;

// Name-first gate, then the reused search/request form with a live-presence card
// on top. Live state comes from polling the PUBLIC /api/events/<slug>/live
// endpoint (reusing the guest 4s cadence) and degrades quietly — a failed poll
// keeps the last good state and never blanks the card or blocks search.
export default function EventJoinClient({
  guestSlug,
  roomSlug,
  eventName,
  hostName,
  eventStatus,
  initialPresence,
}: Props) {
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [returning, setReturning] = useState(false);
  const [presence, setPresence] = useState<GuestLivePresence | null>(initialPresence);
  const presenceRef = useRef<string>(JSON.stringify(initialPresence));

  useEffect(() => {
    const saved = window.localStorage.getItem(guestNameKey(roomSlug));
    if (saved && isValidGuestName(saved)) {
      setName(normalizeGuestName(saved));
      setReturning(true);
      setJoined(true);
    }
    setReady(true);
  }, [roomSlug]);

  // Poll the live presence. Keeps the last good state on any failure (never
  // blanks); skips redundant re-renders when the payload is unchanged.
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(guestSlug)}/live`, { cache: 'no-store' });
      if (!res.ok) return; // keep last good state
      const data = (await res.json()) as GuestLivePresence;
      const sig = JSON.stringify(data);
      if (sig !== presenceRef.current) {
        presenceRef.current = sig;
        setPresence(data);
      }
    } catch {
      /* transient — keep the last good state */
    }
  }, [guestSlug]);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => {
      if (!document.hidden) void poll();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const status: EventStatus = presence?.event.status ?? eventStatus;
  const ended = status === 'ended' || status === 'archived';

  const header = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
    </div>
  );
  const identity = (
    <>
      {hostName && <div className="eyebrow">Hosted by {hostName}</div>}
      <div className="display" style={{ marginTop: hostName ? 4 : 0 }}>
        {eventName}
      </div>
    </>
  );

  // Ended: no name gate, no search — read-only close-out.
  if (ended) {
    const counts = presence?.counts;
    return (
      <>
        {header}
        <div className="card hero glow">
          <div className="eyebrow">This event has ended</div>
          <div className="display" style={{ marginTop: 6 }}>
            {eventName}
          </div>
          {counts ? (
            <p className="lead">
              {counts.requests} {counts.requests === 1 ? 'song' : 'songs'} requested · {counts.guests}{' '}
              {counts.guests === 1 ? 'guest' : 'guests'} joined
            </p>
          ) : (
            <p className="lead">Thanks for singing!</p>
          )}
        </div>
      </>
    );
  }

  // Name-first gate (new guest) — event identity + live card shown above it.
  if (ready && !joined) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const n = normalizeGuestName(name);
      if (!isValidGuestName(n)) return;
      window.localStorage.setItem(guestNameKey(roomSlug), n);
      setName(n);
      setJoined(true);
    };
    return (
      <>
        {header}
        {identity}
        <LivePresenceCard presence={presence} />
        <div className="card glow fade-up">
          <form onSubmit={submit}>
            <label htmlFor="guestname">What should we call you?</label>
            <input
              id="guestname"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              autoFocus
            />
            <button
              type="submit"
              className="primary lg block"
              style={{ marginTop: 14 }}
              disabled={!isValidGuestName(name)}
            >
              Find a Song
            </button>
          </form>
        </div>
      </>
    );
  }

  // Joined (or returning) — identity, optional welcome, live card, then search.
  return (
    <>
      {header}
      <div className="row between" style={{ marginBottom: 4 }}>
        {hostName ? <div className="eyebrow">Hosted by {hostName}</div> : <span />}
        {returning && <span className="pill">Welcome back, {name}</span>}
      </div>
      <div className="display" style={{ marginBottom: 8 }}>
        {eventName}
      </div>
      <LivePresenceCard presence={presence} />
      {ready && <RequestForm slug={roomSlug} roomOpen onSubmitted={() => void poll()} />}
    </>
  );
}
