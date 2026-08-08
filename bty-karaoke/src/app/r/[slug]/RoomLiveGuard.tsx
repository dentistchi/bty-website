'use client';

// V7.1 PART E/F — keeps an ALREADY-OPEN guest screen honest. The screen loaded
// while an Event was live; this guard polls the room's request feed and, the
// instant that Event ends (status → ended) OR is replaced by a different live
// Event (rotation), it replaces the search/request UI with the ended notice.
//
// Critically it holds the eventId the screen FIRST loaded with and keeps checking
// against THAT — a bare-room screen tied to Event 1 never silently hops onto
// Event 2. Joining the next Event requires scanning its new QR.

import { useEffect, useRef, useState } from 'react';
import { useGuestT } from '@/components/guest/GuestLocaleProvider';

interface Props {
  slug: string;
  /** The live Event id this screen was rendered for (null = legacy eventless room). */
  initialEventId: string | null;
  roomName: string;
  pollMs?: number;
  children: React.ReactNode;
}

type Ended = { kind: 'ended' } | { kind: 'superseded' } | null;

export default function RoomLiveGuard({
  slug,
  initialEventId,
  roomName,
  pollMs = 4000,
  children,
}: Props) {
  const t = useGuestT();
  const [ended, setEnded] = useState<Ended>(null);
  const stop = useRef(false);

  useEffect(() => {
    // A legacy eventless screen has no Event to end — never guard it.
    if (!initialEventId) return;
    stop.current = false;

    async function check() {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/requests`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { event?: { id: string; status: string } | null };
        const ev = data.event ?? null;
        if (ev && ev.status === 'ended') setEnded({ kind: 'ended' });
        else if (!ev || ev.id !== initialEventId) setEnded({ kind: 'superseded' });
        else setEnded(null);
      } catch {
        /* transient network error — keep showing the live UI */
      }
    }

    void check();
    const t = window.setInterval(() => {
      if (!stop.current) void check();
    }, pollMs);
    return () => {
      stop.current = true;
      window.clearInterval(t);
    };
  }, [slug, initialEventId, pollMs]);

  if (!ended) return <>{children}</>;

  return (
    <div className="card hero" role="status" data-ended-guard>
      <div className="eyebrow">{t('guest.event.ended.eyebrow')}</div>
      <h1>{roomName}</h1>
      <p className="lead">
        {t(ended.kind === 'superseded' ? 'guest.event.rotated.body' : 'guest.event.just_ended.body')}
      </p>
      <p className="muted">{t('guest.event.ended.retry')}</p>
    </div>
  );
}
