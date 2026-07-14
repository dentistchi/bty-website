// Guest join by pretty slug: /j/<guestSlug>. Resolves the event → its room and
// renders the guest join + search flow (reusing RequestForm). Guests never see a
// room slug, a credential, or a room code. An ended event shows a friendly
// closed screen instead of the request form.

import { getEventByGuestSlug, eventStats } from '@/lib/events.server';
import { eventRoomSlug } from '@/domain/event-code';
import { PRODUCT_NAME } from '@/lib/brand';
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

  if (event.status === 'ended' || event.status === 'archived') {
    const stats = await eventStats(event);
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
        </div>
        <div className="card hero glow">
          <div className="eyebrow">This event has ended</div>
          <div className="display" style={{ marginTop: 6 }}>
            {event.name}
          </div>
          <p className="lead">
            {stats.totalRequests > 0
              ? `${stats.totalRequests} ${stats.totalRequests === 1 ? 'song was' : 'songs were'} requested. Thanks for singing!`
              : 'Thanks for coming!'}
          </p>
        </div>
      </main>
    );
  }

  const roomSlug = eventRoomSlug(event.public_code);
  return (
    <main>
      <EventJoinClient
        roomSlug={roomSlug}
        eventName={event.name}
        hostName={event.host_name}
        notStarted={event.status !== 'active'}
      />
    </main>
  );
}
