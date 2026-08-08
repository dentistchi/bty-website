// @vitest-environment jsdom
//
// Event Lifecycle V1 — REAL render proof that the guard flips an already-open guest
// screen to the ended notice the instant polling reports the Event ended OR was
// rotated, and that it NEVER navigates (no redirect to a newer Event). The prior
// coverage only grepped the source for `initialEventId`; this mounts the component
// and drives it with a mocked feed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import RoomLiveGuard from './RoomLiveGuard';

function mockFeed(event: { id: string; status: string } | null) {
  return vi.fn(async () =>
    ({ ok: true, json: async () => ({ event }) }) as unknown as Response,
  );
}

beforeEach(() => {
  // Guard against accidental real navigation — assert nothing calls it.
  vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RoomLiveGuard — flips to ended, never redirects', () => {
  it('keeps the live children while the feed reports the SAME live event', async () => {
    vi.stubGlobal('fetch', mockFeed({ id: 'evt-1', status: 'active' }));
    renderGuest(
      <RoomLiveGuard slug="bty-home" initialEventId="evt-1" roomName="Friday Night" pollMs={10_000}>
        <div data-testid="live-ui">신청하기</div>
      </RoomLiveGuard>,
    );
    await waitFor(() => expect(screen.getByTestId('live-ui')).toBeTruthy());
    expect(screen.queryByText(/이벤트 종료/)).toBeNull();
  });

  it('flips to the ended notice (hides the request UI) when the feed reports status ended', async () => {
    vi.stubGlobal('fetch', mockFeed({ id: 'evt-1', status: 'ended' }));
    renderGuest(
      <RoomLiveGuard slug="bty-home" initialEventId="evt-1" roomName="Friday Night" pollMs={10_000}>
        <div data-testid="live-ui">신청하기</div>
      </RoomLiveGuard>,
    );
    await waitFor(() => expect(screen.getByText('이벤트 종료')).toBeTruthy());
    // The whole mutation surface is unmounted, not merely disabled.
    expect(screen.queryByTestId('live-ui')).toBeNull();
  });

  it('flips to superseded (does NOT hop) when the room now has a DIFFERENT live event', async () => {
    vi.stubGlobal('fetch', mockFeed({ id: 'evt-2', status: 'active' }));
    renderGuest(
      <RoomLiveGuard slug="bty-home" initialEventId="evt-1" roomName="Friday Night" pollMs={10_000}>
        <div data-testid="live-ui">신청하기</div>
      </RoomLiveGuard>,
    );
    await waitFor(() =>
      expect(screen.getByText(/새 QR을 스캔해 주세요/)).toBeTruthy(),
    );
    expect(screen.queryByTestId('live-ui')).toBeNull();
    // Never navigated to the new event — the old page stays bound to evt-1.
    expect(window.open).not.toHaveBeenCalled();
  });
});
