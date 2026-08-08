// @vitest-environment jsdom
//
// BUILD 26G — QR ENTRY BEHAVIOR, proved by RENDERING the real server component.
//
// The product rule under test:
//
//     A QR identifies the ROOM, not the presentation language.
//
// So the same room, entered through the same QR, must render in whatever language the
// GUEST's browser asks for — and a Host's own language must have no effect at all.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { guestT } from '@/domain/guest-messages';

/**
 * The Room. Note what it does NOT have: any language, locale, or preferred-language field.
 * There is nowhere for a Host to store one, which is the structural half of the guarantee.
 */
const state = {
  room: {
    id: 'room-1',
    slug: 'bty-home',
    display_name: 'BTY Home',
    status: 'open',
    guest_welcome_message: null,
    logo_object_key: null,
    logo_version: null,
    branding_theme: 'midnight_gold',
  } as Record<string, unknown> | null,
  liveEvent: null as null | { id: string; name: string; status: string },
};

vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/events.server', () => ({ getCanonicalEvent: vi.fn(async () => state.liveEvent) }));
vi.mock('./RequestForm', () => ({ default: () => <div data-testid="request-form" /> }));
vi.mock('./QueueBoard', () => ({ default: () => <div data-testid="queue-board" /> }));
vi.mock('./RoomLiveGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="live-guard">{children}</div>,
}));
vi.mock('@/components/legal/GuestConsentGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/** The Guest's own request: their browser's languages, and any choice they already made. */
const guestRequest = {
  acceptLanguage: '' as string,
  localeCookie: undefined as string | undefined,
};
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'accept-language': guestRequest.acceptLanguage }),
  cookies: async () => ({
    get: (name: string) =>
      name === 'bty_guest_locale' && guestRequest.localeCookie
        ? { name, value: guestRequest.localeCookie }
        : undefined,
  }),
}));

import RoomPage from './page';

async function enterViaQr(opts: { acceptLanguage?: string; localeCookie?: string } = {}) {
  guestRequest.acceptLanguage = opts.acceptLanguage ?? '';
  guestRequest.localeCookie = opts.localeCookie;
  const ui = await RoomPage({
    params: Promise.resolve({ slug: 'bty-home' }),
    searchParams: Promise.resolve({}),
  });
  return render(ui);
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  state.liveEvent = { id: 'evt-1', name: 'Friday', status: 'active' };
});

describe('QR entry — the Guest browser decides, the Host does not', () => {
  it('English Guest browser + Korean Host → the Guest surface is ENGLISH', async () => {
    // There is no way to express "the Host is Korean" here, because the Room carries no
    // language. That absence IS the guarantee; this asserts the resulting behaviour.
    const { container } = await enterViaQr({ acceptLanguage: 'en-US,en;q=0.9' });
    expect(container.textContent).toContain(guestT('en', 'guest.room.lead'));
    expect(container.textContent).not.toContain(guestT('ko', 'guest.room.lead'));
  });

  it('Korean Guest browser + English Host → the Guest surface is KOREAN', async () => {
    const { container } = await enterViaQr({ acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8' });
    expect(container.textContent).toContain(guestT('ko', 'guest.room.lead'));
    expect(container.textContent).not.toContain(guestT('en', 'guest.room.lead'));
  });

  it('an unsupported (French) Guest browser → ENGLISH, never Korean', async () => {
    const { container } = await enterViaQr({ acceptLanguage: 'fr-FR,fr;q=0.9,de;q=0.8' });
    expect(container.textContent).toContain(guestT('en', 'guest.room.lead'));
    expect(container.textContent).not.toContain(guestT('ko', 'guest.room.lead'));
  });

  it('no Accept-Language at all → ENGLISH', async () => {
    const { container } = await enterViaQr();
    expect(container.textContent).toContain(guestT('en', 'guest.room.lead'));
  });

  it('the SAME room and the SAME QR render differently for two different Guests', async () => {
    const english = await enterViaQr({ acceptLanguage: 'en-US' });
    const englishText = english.container.textContent ?? '';
    cleanup();
    const korean = await enterViaQr({ acceptLanguage: 'ko-KR' });
    const koreanText = korean.container.textContent ?? '';
    expect(englishText).not.toBe(koreanText);
    // …and the room identity itself is identical in both — the QR still names ONE room.
    expect(englishText).toContain('BTY Home');
    expect(koreanText).toContain('BTY Home');
  });

  it("a Guest's stored choice beats their browser default on the server too", async () => {
    // Korean browser, but this Guest previously chose English: first paint is English, so
    // there is no flash of the wrong language before hydration.
    const { container } = await enterViaQr({ acceptLanguage: 'ko-KR,ko;q=0.9', localeCookie: 'en' });
    expect(container.textContent).toContain(guestT('en', 'guest.room.lead'));
  });

  it('an unsupported stored value is ignored and the browser decides', async () => {
    const { container } = await enterViaQr({ acceptLanguage: 'ko-KR', localeCookie: 'fr' });
    expect(container.textContent).toContain(guestT('ko', 'guest.room.lead'));
  });
});

describe('QR entry — every Guest branch is localized and offers the switcher', () => {
  it('the live room branch', async () => {
    const { container } = await enterViaQr({ acceptLanguage: 'en-US' });
    expect(container.querySelector('[data-guest-language-switcher]')).toBeTruthy();
    expect(screen.getByText(guestT('en', 'guest.brand.tagline'))).toBeTruthy();
  });

  it('the no-active-event branch', async () => {
    state.liveEvent = null;
    const { container } = await enterViaQr({ acceptLanguage: 'en-US' });
    expect(container.textContent).toContain(guestT('en', 'guest.event.none.title'));
    expect(container.querySelector('[data-guest-language-switcher]')).toBeTruthy();
  });

  it('the ended-QR branch', async () => {
    guestRequest.acceptLanguage = 'en-US';
    guestRequest.localeCookie = undefined;
    state.liveEvent = { id: 'evt-NEW', name: 'Later', status: 'active' };
    const ui = await RoomPage({
      params: Promise.resolve({ slug: 'bty-home' }),
      searchParams: Promise.resolve({ e: 'evt-OLD' }),
    });
    const { container } = render(ui);
    expect(container.textContent).toContain(guestT('en', 'guest.event.ended.title'));
    expect(container.querySelector('[data-guest-language-switcher]')).toBeTruthy();
  });

  it('the room-not-found branch', async () => {
    state.room = null;
    const { container } = await enterViaQr({ acceptLanguage: 'en-US' });
    expect(container.textContent).toContain(guestT('en', 'guest.room.not_found.title'));
    state.room = {
      id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open',
      guest_welcome_message: null, logo_object_key: null, logo_version: null,
      branding_theme: 'midnight_gold',
    };
  });
});

describe('QR entry — the room identity is never translated', () => {
  it('the room display name renders verbatim in both languages', async () => {
    state.room = {
      id: 'room-1', slug: 'chi-norebang', display_name: '치 패밀리 노래방', status: 'open',
      guest_welcome_message: '오늘 함께 노래해요', logo_object_key: null, logo_version: null,
      branding_theme: 'midnight_gold',
    };
    for (const acceptLanguage of ['en-US', 'ko-KR']) {
      cleanup();
      const { container } = await enterViaQr({ acceptLanguage });
      // Server CONTENT — the Host's own words — is shown exactly as stored, in either UI
      // language. Translating a room's name or welcome would be inventing content.
      expect(container.textContent).toContain('치 패밀리 노래방');
      expect(container.textContent).toContain('오늘 함께 노래해요');
    }
  });
});
