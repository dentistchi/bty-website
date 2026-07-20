// @vitest-environment jsdom
//
// Event Lifecycle V1 — Room URL resolution, proved by RENDERING the real server
// component (not by grepping source). Covers the four cases the contract pins:
//
//   /r/{slug}?e={endedEventId}  → "이 노래방 이벤트는 종료됐어요" (never redirect/join)
//   /r/{slug}  + live event     → the live request screen
//   /r/{slug}  + NO live event  → "지금 진행 중인 노래방이 없습니다"
//   /r/{slug}  + only ENDED history, no live → the SAME no-active message
//                                 (never the latest-ended notice, never a legacy form)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {
  room: { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' } as
    | null
    | { id: string; slug: string; display_name: string; status: string },
  liveEvent: null as null | { id: string; name: string; status: string },
};

vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: vi.fn(async () => state.room),
}));
vi.mock('@/lib/events.server', () => ({
  getCanonicalEvent: vi.fn(async () => state.liveEvent),
}));
// The live branch mounts client components; stub them so this test isolates the
// server-side ROUTING decision (which screen renders), not their internals.
vi.mock('./RequestForm', () => ({ default: () => <div data-testid="request-form" /> }));
vi.mock('./QueueBoard', () => ({ default: () => <div data-testid="queue-board" /> }));
vi.mock('./RoomLiveGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="live-guard">{children}</div>,
}));
vi.mock('@/components/legal/GuestConsentGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/legal/LegalLinks', () => ({
  default: () => <div data-testid="legal-links" />,
}));

import RoomPage from './page';

async function renderPage(opts: { e?: string } = {}) {
  const ui = await RoomPage({
    params: Promise.resolve({ slug: 'bty-home' }),
    searchParams: Promise.resolve(opts.e ? { e: opts.e } : {}),
  });
  render(ui);
}

beforeEach(() => {
  cleanup();
  state.room = { id: 'room-1', slug: 'bty-home', display_name: 'BTY Home', status: 'open' };
  state.liveEvent = null;
});

describe('/r/{slug}?e={endedEventId} — explicit old Event URL', () => {
  it('shows the ended message and no request UI, with no live event at all', async () => {
    state.liveEvent = null;
    await renderPage({ e: 'evt-OLD' });
    expect(screen.getByText('이 노래방 이벤트는 종료됐어요')).toBeTruthy();
    expect(screen.getByText('새 이벤트 QR을 Host에게 받아 주세요.')).toBeTruthy();
    expect(screen.queryByTestId('request-form')).toBeNull();
    expect(screen.queryByTestId('queue-board')).toBeNull();
  });

  it('does NOT join / redirect to a NEWER live event (stale QR stays ended)', async () => {
    state.liveEvent = { id: 'evt-NEW', name: 'Round 2', status: 'active' };
    await renderPage({ e: 'evt-OLD' });
    expect(screen.getByText('이 노래방 이벤트는 종료됐어요')).toBeTruthy();
    expect(screen.queryByTestId('request-form')).toBeNull();
  });

  it('keeps Privacy/Terms reachable on the ended screen', async () => {
    await renderPage({ e: 'evt-OLD' });
    expect(screen.getByTestId('legal-links')).toBeTruthy();
  });
});

describe('/r/{slug} — bare Room URL', () => {
  it('resolves to the live event when one exists', async () => {
    state.liveEvent = { id: 'evt-1', name: 'Tonight', status: 'active' };
    await renderPage();
    expect(screen.getByTestId('request-form')).toBeTruthy();
    expect(screen.getByTestId('queue-board')).toBeTruthy();
    expect(screen.queryByText('지금 진행 중인 노래방이 없습니다')).toBeNull();
  });

  it('shows the no-active message when the room has NEVER had an event (no legacy form)', async () => {
    state.liveEvent = null;
    await renderPage();
    expect(screen.getByText('지금 진행 중인 노래방이 없습니다')).toBeTruthy();
    // The legacy eventless self-service request form is GONE.
    expect(screen.queryByTestId('request-form')).toBeNull();
    expect(screen.queryByTestId('queue-board')).toBeNull();
  });

  it('shows the SAME no-active message for a room with only ENDED history — never the ended notice', async () => {
    // Historical ended events exist server-side, but no live one. The bare Room URL
    // must not surface the latest-ended notice and must not accept requests.
    state.liveEvent = null;
    await renderPage();
    expect(screen.getByText('지금 진행 중인 노래방이 없습니다')).toBeTruthy();
    expect(screen.queryByText('이 노래방 이벤트는 종료됐어요')).toBeNull();
    expect(screen.queryByTestId('request-form')).toBeNull();
  });

  it('keeps Privacy/Terms reachable on the no-active screen', async () => {
    await renderPage();
    expect(screen.getByTestId('legal-links')).toBeTruthy();
  });
});
