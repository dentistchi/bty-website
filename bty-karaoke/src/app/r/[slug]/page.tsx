import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent } from '@/lib/events.server';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import RequestForm from './RequestForm';
import QueueBoard from './QueueBoard';
import RoomLiveGuard from './RoomLiveGuard';
import GuestFreshnessGuard from './GuestFreshnessGuard';
import GuestConsentGate from '@/components/legal/GuestConsentGate';
import LegalLinks from '@/components/legal/LegalLinks';
import { normalizeTheme } from '@/domain/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Room Settings V1 — the Room's guest-facing identity: its editable display name
// and, when set, the optional welcome message. Shown whether or not an Event is
// live (a guest who lands before karaoke starts still sees whose Room this is). The
// welcome renders ONLY when present — no empty placeholder when it is null.
function GuestRoomHeader({
  room,
}: {
  room: {
    slug: string;
    display_name: string;
    status: string;
    guest_welcome_message: string | null;
    logo_object_key: string | null;
    logo_version: string | null;
  };
}) {
  // Logo is delivered through the controlled public proxy (never the private URL).
  // Absent logo → clean text identity, no broken image / empty box.
  const logoUrl = room.logo_object_key
    ? `/api/public/rooms/${encodeURIComponent(room.slug)}/logo?v=${room.logo_version ?? ''}`
    : null;
  return (
    <div className="room-identity">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="room-logo" src={logoUrl} alt={`${room.display_name} 로고`} width={72} height={72} />
      ) : null}
      <div className="room-identity-text">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>{room.display_name}</h1>
          <span className="tag">{room.status === 'open' ? '열림' : '닫힘'}</span>
        </div>
        {room.guest_welcome_message ? (
          <p className="lead" data-guest-welcome>
            {room.guest_welcome_message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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

  // Event Lifecycle V1 — EXPLICIT ended-Event URL. A QR carries the id of the Event
  // it was printed for (`?e=`). If that id is not the room's current live Event this
  // is a previous round's QR: never join a newer Event, never auto-redirect, never
  // create one, never fall through to the live form.
  const scopedToPastEvent = Boolean(assertedEventId) && assertedEventId !== eventId;

  if (scopedToPastEvent) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
        </div>
        <div className="card hero" data-event-ended>
          <div className="eyebrow">이벤트 종료</div>
          <h1>이 노래방 이벤트는 종료됐어요</h1>
          <p className="lead">새 이벤트 QR을 Host에게 받아 주세요.</p>
        </div>
        {/* Privacy/Terms/Contact stay reachable on every guest screen. */}
        <LegalLinks showContact />
      </main>
    );
  }

  // Event Lifecycle V1 — the bare Room URL resolves to the genuinely live Event or
  // to an honest "no karaoke running" state. It NEVER surfaces the latest ended
  // Event, NEVER renders the legacy eventless request form, never accepts requests,
  // and never creates an Event.
  if (!event) {
    return (
      <main data-theme={normalizeTheme(room.branding_theme)}>
        <GuestFreshnessGuard />
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
          <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
        </div>
        <GuestRoomHeader room={room} />
        <div className="card hero" data-no-active-event>
          <h2>지금 진행 중인 노래방이 없습니다</h2>
          <p className="muted">진행자가 새 이벤트를 시작하면 새 QR로 신청할 수 있어요.</p>
        </div>
        <LegalLinks showContact />
      </main>
    );
  }

  return (
    <main data-theme={normalizeTheme(room.branding_theme)}>
      <GuestFreshnessGuard />
      <div className="brand-head">
        <span className="brand">{PRODUCT_NAME}</span>
        <span className="brand-tag">{PRODUCT_TAGLINE_KO}</span>
      </div>
      <GuestRoomHeader room={room} />
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
