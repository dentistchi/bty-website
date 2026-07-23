// BTY Player — the ONE same-origin player tab per Room. It stays on our origin
// (norebang.btydaily.com) and embeds the official YouTube IFrame Player API; only the
// embedded video changes. This replaces the cross-origin youtube.com popup, which — under
// youtube's Cross-Origin-Opener-Policy: same-origin-allow-popups — landed in a separate
// browsing-context group, severing the named-window handle so every song accumulated a new
// tab (see docs / the Gate A diagnostic).
//
// SECURITY: like the Display, this renders ONLY public room data — the canonical playing
// video id (already visible to anyone who scanned the guest QR). It exposes NO session_id,
// dj_secret, room UUID, email, account subject, token, passcode, or any private Host data.
// It never navigates anywhere arbitrary: the only thing it ever loads is a server-validated
// 11-char YouTube video id via the IFrame API.

import { getPublicRoomBySlug, getDisplayState } from '@/lib/rooms.server';
import { getCanonicalEvent, getLatestEndedEvent } from '@/lib/events.server';
import { isValidVideoId } from '@/domain/youtube';
import { PRODUCT_NAME } from '@/lib/brand';
import PlayerClient from './PlayerClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
        </div>
        <div className="card hero">
          <div className="display-sm">Room not found</div>
          <p className="lead">No room exists for “{slug}”.</p>
        </div>
      </main>
    );
  }

  // Resolve the room's ONE canonical event identity (live, else most-recent ended), then
  // read the public display state scoped to THAT event — the same authority the Display
  // uses. The initial playing video (if any) is server-validated before it reaches the DOM.
  const live = await getCanonicalEvent(room.id);
  const event = live ?? (await getLatestEndedEvent(room.id));
  const state = await getDisplayState(room, event?.id ?? null);
  const rawInitial = state.playing?.videoId ?? null;
  const initialVideoId = isValidVideoId(rawInitial) ? rawInitial : null;

  return (
    <PlayerClient
      slug={room.slug}
      roomName={event?.name ?? room.display_name}
      eventId={event?.id ?? null}
      initialVideoId={initialVideoId}
    />
  );
}
