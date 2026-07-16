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
      <div className="eyebrow">이벤트 종료</div>
      <h1>{roomName}</h1>
      <p className="lead">
        {ended.kind === 'superseded'
          ? '이 이벤트는 종료되었어요. 새 이벤트에 참여하려면 새 QR을 스캔해 주세요.'
          : '이 이벤트가 방금 종료되었어요. 오늘의 기록은 그대로 보존됩니다.'}
      </p>
      <p className="muted">진행자가 새 이벤트를 시작하면 새 QR로 다시 신청할 수 있어요.</p>
    </div>
  );
}
