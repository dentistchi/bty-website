'use client';

import { useEffect, useState } from 'react';
import { PRODUCT_NAME } from '@/lib/brand';
import { guestNameKey, normalizeGuestName, isValidGuestName } from '@/domain/guest-identity';
import RequestForm from '@/app/r/[slug]/RequestForm';

interface Props {
  /** Internal room slug (never shown) that backs the queue/request APIs. */
  roomSlug: string;
  eventName: string;
  hostName: string | null;
  notStarted: boolean;
}

// Name-first gate, then the reused search/request form. The name is remembered
// per room on this device (the SAME key RequestForm reads), so a returning guest
// skips straight in — it is a convenience label, never authentication.
export default function EventJoinClient({ roomSlug, eventName, hostName, notStarted }: Props) {
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(guestNameKey(roomSlug));
    if (saved && isValidGuestName(saved)) {
      setName(normalizeGuestName(saved));
      setReturning(true);
      setJoined(true);
    }
    setReady(true);
  }, [roomSlug]);

  const header = (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
    </div>
  );

  const eventHead = (
    <>
      <div className="eyebrow">{hostName ? `Hosted by ${hostName}` : 'Karaoke'}</div>
      <div className="display" style={{ marginTop: 4 }}>
        {eventName}
      </div>
    </>
  );

  if (!ready) {
    return (
      <>
        {header}
        <p className="lead">Loading…</p>
      </>
    );
  }

  if (notStarted) {
    return (
      <>
        {header}
        <div className="card hero glow">
          {eventHead}
          <p className="lead" style={{ marginTop: 10 }}>
            The karaoke night hasn’t started yet. Hang tight — the host will open it any moment.
          </p>
        </div>
      </>
    );
  }

  if (!joined) {
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
        <div className="card hero glow fade-up">
          {eventHead}
          <form onSubmit={submit} style={{ marginTop: 16 }}>
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

  return (
    <>
      {header}
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="eyebrow">{hostName ? `Hosted by ${hostName}` : 'Karaoke'}</div>
        {returning && <span className="pill">Welcome back, {name}</span>}
      </div>
      <div className="display" style={{ marginBottom: 8 }}>
        {eventName}
      </div>
      <RequestForm slug={roomSlug} roomOpen />
    </>
  );
}
