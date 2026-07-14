'use client';

import { presenceState, type GuestLivePresence } from '@/domain/live-presence';

interface Props {
  /** Null when the live status could not be loaded (first fetch failed). */
  presence: GuestLivePresence | null;
}

function Counts({ presence }: { presence: GuestLivePresence }) {
  const { guests, requests } = presence.counts;
  return (
    <div className="live-counts">
      {guests} {guests === 1 ? 'guest' : 'guests'} · {requests} {requests === 1 ? 'request' : 'requests'}
    </div>
  );
}

// Compact, bounded-height stage panel shown ABOVE the search input. High
// contrast, text-first (thumbnail is a small optional accent). No spinner, no
// shimmer — a failed load degrades to a quiet line, never a blank.
export default function LivePresenceCard({ presence }: Props) {
  if (!presence) {
    return (
      <div className="live-card">
        <div className="live-label muted">Live status unavailable</div>
        <div className="live-sub">You can still search and request songs.</div>
      </div>
    );
  }

  const state = presenceState(presence);
  const { nowPlaying, upNext } = presence;

  if (state === 'ready') {
    return (
      <div className="live-card">
        <div className="live-label">READY FOR THE FIRST SONG</div>
        <div className="live-sub">Search and add yours</div>
        <Counts presence={presence} />
      </div>
    );
  }

  if (state === 'up_next') {
    return (
      <div className="live-card">
        <div className="live-label cyan">UP NEXT</div>
        <div className="live-song">{upNext!.title}</div>
        <div className="live-singer">{upNext!.guestName}</div>
        <Counts presence={presence} />
      </div>
    );
  }

  // now_singing or now_singing_up_next
  return (
    <div className="live-card live-now">
      <div className="live-now-row">
        {nowPlaying!.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="live-thumb" src={nowPlaying!.thumbnailUrl} alt="" loading="lazy" />
        )}
        <div className="live-now-text">
          <div className="live-label gold">
            <span className="live-dot" aria-hidden /> NOW SINGING
          </div>
          <div className="live-song">{nowPlaying!.title}</div>
          <div className="live-singer">{nowPlaying!.guestName}</div>
        </div>
      </div>
      {upNext && (
        <div className="live-upnext">
          <span className="live-upnext-label">UP NEXT</span> {upNext.title} · {upNext.guestName}
        </div>
      )}
      <Counts presence={presence} />
    </div>
  );
}
