// @vitest-environment jsdom
//
// Room Settings V1 — the GUEST-facing result, proved by rendering the real server
// component. The updated Room display name shows, and the welcome message shows
// ONLY when present (no empty placeholder when null). Verified in BOTH the live and
// the no-active-event states, since the Room identity is part of the guest surface
// regardless of whether karaoke is running — and rendering never creates an Event.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {
  room: {
    id: 'room-chi',
    slug: 'chi-norebang-xqjbyszq',
    display_name: 'Chi Family Norebang',
    status: 'open',
    guest_welcome_message: null as string | null,
    logo_object_key: null as string | null,
    logo_version: null as string | null,
    branding_theme: 'midnight_gold',
  },
  liveEvent: null as null | { id: string; name: string; status: string },
  canonicalCalls: 0,
};

vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => {
    state.canonicalCalls++;
    return state.liveEvent;
  }),
}));
vi.mock('./RequestForm', () => ({ default: () => <div data-testid="request-form" /> }));
vi.mock('./QueueBoard', () => ({ default: () => <div data-testid="queue-board" /> }));
vi.mock('./RoomLiveGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/legal/GuestConsentGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/legal/LegalLinks', () => ({ default: () => <div /> }));

import RoomPage from './page';

async function renderPage() {
  render(await RoomPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }), searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  cleanup();
  state.room = {
    id: 'room-chi',
    slug: 'chi-norebang-xqjbyszq',
    display_name: 'Chi Family Norebang',
    status: 'open',
    guest_welcome_message: null,
    logo_object_key: null,
    logo_version: null,
    branding_theme: 'midnight_gold',
  };
  state.liveEvent = null;
  state.canonicalCalls = 0;
});

describe('guest surface — branding (theme + logo)', () => {
  it('applies the selected theme to the page via data-theme', async () => {
    state.room.branding_theme = 'neon_night';
    const { container } = render(
      await RoomPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }), searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector('main')?.getAttribute('data-theme')).toBe('neon_night');
  });

  it('renders the logo via the public proxy (versioned) when a logo exists', async () => {
    state.room.logo_object_key = 'rooms/room-chi/logo-X.webp';
    state.room.logo_version = 'ver123';
    await renderPage();
    const img = screen.getByAltText('Chi Family Norebang 로고') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/public/rooms/chi-norebang-xqjbyszq/logo?v=ver123');
  });

  it('renders NO logo image (clean text fallback) when there is no logo', async () => {
    state.room.logo_object_key = null;
    const { container } = render(
      await RoomPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }), searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector('img.room-logo')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Chi Family Norebang' })).toBeTruthy();
  });

  it('coerces an unexpected stored theme to the default on render (defense in depth)', async () => {
    state.room.branding_theme = 'bogus';
    const { container } = render(
      await RoomPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }), searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector('main')?.getAttribute('data-theme')).toBe('midnight_gold');
  });
});

describe('guest surface — updated Room name', () => {
  it('renders the updated display name (live event)', async () => {
    state.liveEvent = { id: 'ev-1', name: 'night', status: 'active' };
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Chi Family Norebang' })).toBeTruthy();
    expect(screen.getByTestId('request-form')).toBeTruthy();
  });

  it('renders the updated display name even with no active event', async () => {
    state.liveEvent = null;
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Chi Family Norebang' })).toBeTruthy();
    expect(screen.getByText('지금 진행 중인 노래방이 없습니다')).toBeTruthy();
  });
});

describe('guest surface — welcome message only when present', () => {
  it('shows the welcome message when set (live)', async () => {
    state.liveEvent = { id: 'ev-1', name: 'night', status: 'active' };
    state.room.guest_welcome_message = '오늘 함께 노래하고 즐거운 추억을 만들어 보세요.';
    await renderPage();
    expect(screen.getByText('오늘 함께 노래하고 즐거운 추억을 만들어 보세요.')).toBeTruthy();
  });

  it('shows the welcome message when set (no active event)', async () => {
    state.liveEvent = null;
    state.room.guest_welcome_message = '환영합니다';
    await renderPage();
    expect(screen.getByText('환영합니다')).toBeTruthy();
  });

  it('renders NO welcome element when the message is null (no empty placeholder)', async () => {
    state.liveEvent = { id: 'ev-1', name: 'night', status: 'active' };
    state.room.guest_welcome_message = null;
    const { container } = render(
      await RoomPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }), searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector('[data-guest-welcome]')).toBeNull();
  });

  it('reads persisted values fresh each render (force-dynamic) and creates no Event', async () => {
    state.liveEvent = null;
    state.room.guest_welcome_message = '문구';
    await renderPage();
    // getCanonicalEvent is a pure read; the page never calls a create/start path.
    expect(state.canonicalCalls).toBe(1);
    expect(screen.getByText('문구')).toBeTruthy();
  });
});
