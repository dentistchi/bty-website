// @vitest-environment jsdom
//
// BUILD 20B-WEB7 — end-to-end wiring in the REAL RequestForm: an anonymous Guest
// bookmarks a search result (no request created), it appears in 내 노래, and
// 신청하기 from there drives the SAME request POST. Proves save↔request independence.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import RequestForm from './RequestForm';
import { guestNameKey } from '@/domain/guest-identity';
import { SAVED_SONGS_KEY, parseSavedSongs } from '@/domain/saved-songs';

const SLUG = 'bty-home';
const EVENT = 'evt-1';
const VIDEO = 'dQw4w9WgXcQ';

let createdCount: number;
const jsonRes = (obj: unknown, ok = true, status = 200) => ({
  ok,
  status,
  headers: { get: () => null },
  json: async () => obj,
});

function installFetch() {
  createdCount = 0;
  global.fetch = vi.fn(async (url: unknown, opts?: { method?: string }) => {
    const u = String(url);
    if (u.includes('/api/youtube/search')) {
      return jsonRes({ items: [{ videoId: VIDEO, title: '밤편지', channelTitle: '아이유', thumbnailUrl: null }] });
    }
    if (u.includes('/api/youtube/recommend')) return jsonRes({ items: [] });
    if (/\/requests$/.test(u) && opts?.method === 'POST') {
      createdCount += 1;
      const id = `new-${createdCount}`;
      return jsonRes(
        { ok: true, request: { id, youtube_title: '밤편지', youtube_video_id: VIDEO }, cancelToken: `cap-${id}` },
        true,
        201,
      );
    }
    if (u.endsWith('/display')) return jsonRes({ playing: null, next: null, waiting: [], waitingCount: 0, event: { id: EVENT, status: 'active' } });
    if (/\/requests\/[^/]+$/.test(u)) return jsonRes({}, false, 404);
    if (u.includes('/api/guest-app-handoffs')) return jsonRes({});
    return jsonRes({});
  }) as unknown as typeof fetch;
}

async function search() {
  const input = screen.getByPlaceholderText('노래 제목 또는 가수') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '밤편지' } });
  fireEvent.submit(input.closest('form')!);
  await screen.findByText('밤편지');
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(guestNameKey(SLUG), '한빛');
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RequestForm — web My Songs parity wiring', () => {
  it('bookmarking a search result saves to localStorage and creates NO request', async () => {
    render(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    await search();
    fireEvent.click(screen.getByRole('button', { name: /밤편지 저장$/ }));

    await waitFor(() => expect(parseSavedSongs(window.localStorage.getItem(SAVED_SONGS_KEY))).toHaveLength(1));
    expect(createdCount).toBe(0); // save is not a request
    // The saved song is the search item.
    expect(parseSavedSongs(window.localStorage.getItem(SAVED_SONGS_KEY))[0].videoId).toBe(VIDEO);
  });

  it('a saved song appears in 내 노래 and 신청하기 there reuses the request POST', async () => {
    render(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    await search();
    fireEvent.click(screen.getByRole('button', { name: /밤편지 저장$/ }));

    // Open the 내 노래 accordion — the saved song is listed.
    const myHead = screen.getByRole('button', { name: /내 노래/ });
    await waitFor(() => expect(within(myHead).getByText('1')).toBeTruthy());
    fireEvent.click(myHead);

    const section = myHead.closest('section')!;
    fireEvent.click(within(section).getByRole('button', { name: /신청하기/ }));
    await waitFor(() => expect(createdCount).toBe(1)); // exactly one request via the shared pipeline

    // The song remains saved after being requested (request never removes a save).
    expect(parseSavedSongs(window.localStorage.getItem(SAVED_SONGS_KEY))).toHaveLength(1);
  });

  it('the 내 노래 header renders at count 0 (always visible)', async () => {
    render(<RequestForm slug={SLUG} roomOpen eventId={EVENT} />);
    const myHead = await screen.findByRole('button', { name: /내 노래/ });
    expect(within(myHead).getByText('0')).toBeTruthy();
  });
});
