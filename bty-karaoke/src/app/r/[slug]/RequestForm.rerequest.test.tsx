// @vitest-environment jsdom
//
// QUEUE TRUTH V1.0.1 — re-request ownership registration.
// Reproduces the physical failure: tapping 다시 신청 on a completed song creates the
// request server-side, but the guest dock stays "내 신청곡 0" — the new id never lands
// in the owned-request tracker. Drives the REAL RequestForm + dock with a mocked
// network and asserts the active count goes 0 → 1 without a reload.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import RequestForm from './RequestForm';
import { myRequestsKey } from '@/domain/guest-requests';
import { guestNameKey } from '@/domain/guest-identity';

const SLUG = 'bty-home';
const EVENT = 'evt-1';

type Status = {
  requestId: string;
  state: 'waiting' | 'up_next' | 'now_playing' | 'done' | 'removed' | 'not_found';
  position: number;
  aheadCount: number;
  isUpNext: boolean;
  isNowPlaying: boolean;
  readyAt: string | null;
};
const st = (over: Partial<Status>): Status => ({
  requestId: '',
  state: 'waiting',
  position: 0,
  aheadCount: 0,
  isUpNext: false,
  isNowPlaying: false,
  readyAt: null,
  ...over,
});

let statusById: Record<string, Status>;
let createdCount: number;
const jsonRes = (obj: unknown, ok = true, status = 200) => ({
  ok,
  status,
  headers: { get: () => null },
  json: async () => obj,
});

function installFetch() {
  createdCount = 0;
  global.fetch = vi.fn(async (url: unknown, opts?: { method?: string; body?: string }) => {
    const u = String(url);
    // Create a request (submit / re-request).
    if (/\/requests$/.test(u) && opts?.method === 'POST') {
      createdCount += 1;
      const id = `new-${createdCount}`;
      statusById[id] = st({ state: 'up_next', position: 1, isUpNext: true });
      return jsonRes({
        ok: true,
        request: { id, youtube_title: 'Re Song', youtube_video_id: 'VIDNEW', youtube_channel_title: '' },
        cancelToken: `cap-${id}`,
        status: { ...statusById[id], requestId: id },
        activeCount: 1,
      }, true, 201);
    }
    if (u.endsWith('/display')) return jsonRes({ playing: null, next: { id: 'new-1' } });
    const gm = u.match(/\/requests\/([^/]+)$/);
    if (gm) {
      const id = decodeURIComponent(gm[1]);
      const s = statusById[id];
      if (!s) return jsonRes({}, false, 404);
      return jsonRes({ status: { ...s, requestId: id } });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(guestNameKey(SLUG), '한빛');
  // One COMPLETED song already in the owned tracker (today's history).
  window.localStorage.setItem(
    myRequestsKey(SLUG, EVENT),
    JSON.stringify([
      { requestId: 'old-1', cancelToken: 'cap-old', title: 'Old Song', artist: '', videoId: 'VIDOLD', submittedAt: Date.now() },
    ]),
  );
  statusById = { 'old-1': st({ state: 'done' }) };
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('re-request registers ownership and updates the active count', () => {
  it('내 신청곡 0 → 1 after 다시 신청, without reload; history unchanged', async () => {
    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);

    // Initially: the one owned song is completed → active count 0.
    const pill = await screen.findByRole('button', { name: '내 신청곡 0곡 열기' });
    fireEvent.click(pill);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 신청' }));

    // The new request must register → active count becomes 1 (no reload). Assert via
    // the pill aria-label (a single string; the visible "내 신청곡 {n}" splits nodes).
    await waitFor(() => expect(screen.getByRole('button', { name: '내 신청곡 1곡 열기' })).toBeTruthy());
    // Exactly one request was created.
    expect(createdCount).toBe(1);
    // History still shows the completed song.
    expect(within(screen.getByRole('dialog')).getByText(/오늘 부른 노래 1/)).toBeTruthy();
  });

  it('a stale prune (removed row, 6s) does NOT drop a concurrently re-requested song', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The guest holds a REMOVED request (its prune is scheduled) + a completed one.
    window.localStorage.setItem(
      myRequestsKey(SLUG, EVENT),
      JSON.stringify([
        { requestId: 'rem-1', cancelToken: 'cap-rem', title: 'Cancelled', artist: '', videoId: 'VIDREM', submittedAt: Date.now() },
        { requestId: 'old-1', cancelToken: 'cap-old', title: 'Old Song', artist: '', videoId: 'VIDOLD', submittedAt: Date.now() },
      ]),
    );
    statusById = { 'rem-1': st({ state: 'removed' }), 'old-1': st({ state: 'done' }) };

    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    // Let the first poll classify rem-1 as removed → schedules removeMyRequest(+6s).
    await vi.advanceTimersByTimeAsync(100);
    fireEvent.click(await screen.findByRole('button', { name: /내 신청곡 0곡 열기/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 신청' }));
    await vi.advanceTimersByTimeAsync(100);
    // The re-requested song registered → count 1.
    await waitFor(() => expect(screen.getByRole('button', { name: '내 신청곡 1곡 열기' })).toBeTruthy());
    // Now fire the stale prune (6s) for the removed row: it must NOT drop the new song.
    await vi.advanceTimersByTimeAsync(7000);
    expect(screen.getByRole('button', { name: '내 신청곡 1곡 열기' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('rapid double-tap 다시 신청 creates exactly one request', async () => {
    renderGuest(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    fireEvent.click(await screen.findByRole('button', { name: '내 신청곡 0곡 열기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText(/오늘 부른 노래 1/));
    const btn = within(dialog).getByRole('button', { name: '다시 신청' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(createdCount).toBeGreaterThan(0));
    expect(createdCount).toBe(1);
  });
});
