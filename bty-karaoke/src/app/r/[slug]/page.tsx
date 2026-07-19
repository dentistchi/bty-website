import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent, getLatestEndedEvent } from '@/lib/events.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import RequestForm from './RequestForm';
import QueueBoard from './QueueBoard';
import RoomLiveGuard from './RoomLiveGuard';
import GuestConsentGate from '@/components/legal/GuestConsentGate';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { slug } = await params;
  const { e: assertedEventId } = await searchParams;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <h1>Room not found</h1>
        <p className="muted">No room exists for “{slug}”.</p>
      </main>
    );
  }

  // The room's ONE canonical live event (or null once its Event has been ended and
  // the Admin has not yet started a new one). Threaded to the guest client to
  // namespace the ownership localStorage by event AND to scope requests to the
  // exact Event this QR was printed for — a guest read never creates an event.
  const event = await getCanonicalEvent(room.id);
  const eventId = event?.id ?? null;

  // V7 PART E/F — honest ended / expired-QR states. A QR carries the id of the
  // Event it was printed for (`?e=`). If that id is not the room's current live
  // Event, this is a previous round's QR: never join the new Event, never
  // auto-redirect, never create one — show a clear notice.
  const scopedToPastEvent = Boolean(assertedEventId) && assertedEventId !== eventId;
  const endedEvent = event ? null : await getLatestEndedEvent(room.id);

  if (scopedToPastEvent || (!event && endedEvent)) {
    const endedName = (event ? null : endedEvent)?.name ?? room.display_name;
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
        </div>
        <div className="card hero">
          <div className="eyebrow">이벤트 종료</div>
          <h1>{endedName}</h1>
          <p className="lead">
            {scopedToPastEvent
              ? '이 QR은 지난 이벤트의 것이에요. 새 이벤트의 QR을 다시 스캔해 주세요.'
              : '이 이벤트는 종료되었어요. 새 이벤트가 시작되면 새 QR을 스캔해 주세요.'}
          </p>
          <p className="muted">진행자가 새 이벤트를 시작하면 다시 신청할 수 있어요.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{room.display_name}</h1>
        <span className="tag">{room.status === 'open' ? '열림' : '닫힘'}</span>
      </div>
      <p className="muted">노래를 검색해 신청하고, 내 차례가 되면 직접 시작하세요.</p>

      {/* V7.1: flips this already-open screen to the ended notice the instant the
          Event ends or is rotated, so a live screen never keeps taking requests. */}
      <RoomLiveGuard slug={room.slug} initialEventId={eventId} roomName={room.display_name}>
        {/* First-use consent gates the YouTube search/request flow (not the queue view). */}
        <GuestConsentGate>
          <RequestForm slug={room.slug} roomOpen={room.status === 'open'} eventId={eventId} />
        </GuestConsentGate>

        {/* Live full-queue view (canonical /display resolver, my songs highlighted). */}
        <QueueBoard slug={room.slug} eventId={eventId} />
      </RoomLiveGuard>

      {/* Persistent, always-visible legal links on the guest room / search screen. */}
      <LegalLinks showContact />
    </main>
  );
}
