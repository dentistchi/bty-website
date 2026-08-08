import { headers, cookies } from 'next/headers';
import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getCanonicalEvent } from '@/lib/events.server';
import { PRODUCT_NAME } from '@/lib/brand';
import {
  GUEST_LOCALE_COOKIE,
  parseAcceptLanguage,
  resolveGuestLocale,
  type GuestLocale,
} from '@/domain/guest-locale';
import { guestT } from '@/domain/guest-messages';
import { GuestLocaleProvider } from '@/components/guest/GuestLocaleProvider';
import GuestLanguageSwitcher from '@/components/guest/GuestLanguageSwitcher';
import RequestForm from './RequestForm';
import QueueBoard from './QueueBoard';
import RoomLiveGuard from './RoomLiveGuard';
import GuestFreshnessGuard from './GuestFreshnessGuard';
import GuestConsentGate from '@/components/legal/GuestConsentGate';
import GuestLegalLinks from '@/components/guest/GuestLegalLinks';
import { normalizeTheme } from '@/domain/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// BUILD 26G — the Guest's language, resolved for THIS request.
//
// The Room is not consulted. A QR identifies the room; it never carries a presentation
// language, so a Korean Host's QR cannot make an English browser render Korean.
//
// `Accept-Language` is the server's view of the same browser setting `navigator.languages`
// exposes to the client, and the cookie is the Guest's own explicit choice mirrored out of
// localStorage — so first paint already matches what the client will resolve after
// hydration, with no flash. Neither input can be written by a Host.
async function resolveRequestLocale(): Promise<GuestLocale> {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return resolveGuestLocale({
    stored: cookieStore.get(GUEST_LOCALE_COOKIE)?.value ?? null,
    browserLanguages: parseAcceptLanguage(headerList.get('accept-language')),
  });
}

/** The Guest chrome every branch shows: the wordmark, the tagline, and the switcher. */
function GuestBrandHead({ locale }: { locale: GuestLocale }) {
  return (
    <div className="brand-head">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="brand-tag">{guestT(locale, 'guest.brand.tagline')}</span>
      {/* Reachable on every Guest screen — before entering the room and after. */}
      <GuestLanguageSwitcher />
    </div>
  );
}

// Room Settings V1 — the Room's guest-facing identity: its editable display name
// and, when set, the optional welcome message. Shown whether or not an Event is
// live (a guest who lands before karaoke starts still sees whose Room this is). The
// welcome renders ONLY when present — no empty placeholder when it is null.
function GuestRoomHeader({
  room,
  locale,
}: {
  locale: GuestLocale;
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
        <img
          className="room-logo"
          src={logoUrl}
          alt={guestT(locale, 'guest.room.logo_alt', { name: room.display_name })}
          width={72}
          height={72}
        />
      ) : null}
      <div className="room-identity-text">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>{room.display_name}</h1>
          <span className="tag">
            {guestT(locale, room.status === 'open' ? 'guest.room.status.open' : 'guest.room.status.closed')}
          </span>
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
  const locale = await resolveRequestLocale();
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <h1>{guestT(locale, 'guest.room.not_found.title')}</h1>
        <p className="muted">{guestT(locale, 'guest.room.not_found.body', { slug })}</p>
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
      <GuestLocaleProvider initialLocale={locale}>
        <main>
          <GuestBrandHead locale={locale} />
          <div className="card hero" data-event-ended>
            <div className="eyebrow">{guestT(locale, 'guest.event.ended.eyebrow')}</div>
            <h1>{guestT(locale, 'guest.event.ended.title')}</h1>
            <p className="lead">{guestT(locale, 'guest.event.ended.lead')}</p>
          </div>
          {/* Privacy/Terms/Contact stay reachable on every guest screen. */}
          <GuestLegalLinks showContact />
        </main>
      </GuestLocaleProvider>
    );
  }

  // Event Lifecycle V1 — the bare Room URL resolves to the genuinely live Event or
  // to an honest "no karaoke running" state. It NEVER surfaces the latest ended
  // Event, NEVER renders the legacy eventless request form, never accepts requests,
  // and never creates an Event.
  if (!event) {
    return (
      <GuestLocaleProvider initialLocale={locale}>
        <main data-theme={normalizeTheme(room.branding_theme)}>
          <GuestFreshnessGuard />
          <GuestBrandHead locale={locale} />
          <GuestRoomHeader room={room} locale={locale} />
          <div className="card hero" data-no-active-event>
            <h2>{guestT(locale, 'guest.event.none.title')}</h2>
            <p className="muted">{guestT(locale, 'guest.event.none.body')}</p>
          </div>
          <GuestLegalLinks showContact />
        </main>
      </GuestLocaleProvider>
    );
  }

  return (
    <GuestLocaleProvider initialLocale={locale}>
      <main data-theme={normalizeTheme(room.branding_theme)}>
        <GuestFreshnessGuard />
        <GuestBrandHead locale={locale} />
        <GuestRoomHeader room={room} locale={locale} />
        <p className="muted">{guestT(locale, 'guest.room.lead')}</p>

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
        <GuestLegalLinks showContact />
      </main>
    </GuestLocaleProvider>
  );
}
