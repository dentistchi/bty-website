// Guest join by pretty slug: /j/<guestSlug>. Resolves the event → its room and
// renders the guest join + live-presence + search flow (reusing RequestForm).
// Guests never see a room slug, a credential, or a room code. The event name is
// server-rendered immediately; the live presence + ended handling live in the
// client so polling can transition state without a reload.

import { getEventByGuestSlug, getGuestLivePresenceByEvent, eventRoomSlugOf } from '@/lib/events.server';
import { PRODUCT_NAME } from '@/lib/brand';
import type { GuestLivePresence } from '@/domain/live-presence';
import EventJoinClient from './EventJoinClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function GuestJoinPage({ params }: { params: Promise<{ guestSlug: string }> }) {
  const { guestSlug } = await params;
  const event = await getEventByGuestSlug(guestSlug);

  if (!event) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
        </div>
        <div className="card hero">
          <div className="display-sm">Event not found</div>
          <p className="lead">This invite link isn’t valid. Ask the host for a new QR.</p>
        </div>
      </main>
    );
  }

  // The CANONICAL room slug (from the event's room_id) — never derived from the
  // public code, which is wrong for an event on a pre-existing room and would send
  // the guest's request posts to a non-existent /api/rooms/<slug> route.
  const roomSlug = await eventRoomSlugOf(event);
  if (!roomSlug) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
        </div>
        <div className="card hero">
          <div className="display-sm">Event unavailable</div>
          <p className="lead">This event isn’t open right now. Ask the host for a new QR.</p>
        </div>
      </main>
    );
  }

  // Best-effort initial presence (server-rendered) so the live card appears with
  // no flash. Never blocks the page: on failure the client shows a quiet
  // "unavailable" state and can still search, and still knows the event status.
  let initialPresence: GuestLivePresence | null = null;
  try {
    initialPresence = await getGuestLivePresenceByEvent(event);
  } catch {
    initialPresence = null;
  }

  return (
    <main>
      <EventJoinClient
        guestSlug={guestSlug}
        roomSlug={roomSlug}
        eventName={event.name}
        hostName={event.host_name}
        eventStatus={event.status}
        initialPresence={initialPresence}
      />
    </main>
  );
}
