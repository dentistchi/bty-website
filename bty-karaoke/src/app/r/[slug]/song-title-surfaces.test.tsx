// @vitest-environment jsdom
//
// BUILD 20B-WEB7-R1 — every Web Guest song surface renders through the ONE
// display-only formatter: search cards, My Songs, Recently Sung, own NOW SINGING,
// and the public Queue all show the cleaned title (never provider noise), while the
// raw values handed to request/save callbacks stay unchanged.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import RequestResultCard from './RequestResultCard';
import MySongsSections from './MySongsSections';
import QueueBoard from './QueueBoard';
import MyRequestsDock from './MyRequestsDock';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import type { SavedSong } from '@/domain/saved-songs';
import type { RecentlySung } from '@/domain/recently-sung';
import type { MyRequest } from '@/domain/guest-requests';

const NOISY = '[TJ노래방] 난 - 옥주현 / TJ Karaoke';
const NOISY_CHANNEL = 'TJ노래방 공식 유튜브채널';
// The EXACT top live result that rendered provider-first before R2 (dangling "]").
const LIVE_FAIL = 'MR 노래방ㆍkaraoke] 난 - 옥주현 ㆍTroublousness - Oak Joo-hyun';
const LIVE_FAIL_CHANNEL = 'MR 노래방 l MR karaoke';

afterEach(cleanup);

describe('R2 — the exact live provider-first row (search card)', () => {
  it('renders the song title first, never "MR 노래방…"', () => {
    const item: YoutubeSearchItem = { videoId: 'dQw4w9WgXcQ', title: LIVE_FAIL, channelTitle: LIVE_FAIL_CHANNEL, thumbnailUrl: null };
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} saved={false} onToggleSave={vi.fn()} />);
    const titleEl = document.querySelector('.req-card .title') as HTMLElement;
    expect(titleEl.textContent!.startsWith('난')).toBe(true);
    expect(titleEl.textContent!.startsWith('MR')).toBe(false);
    expect(screen.queryByText(/MR 노래방ㆍkaraoke/)).toBeNull();
    // Bookmark + 신청하기 still reachable (14).
    expect(screen.getByRole('button', { name: /저장$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /신청하기/ })).toBeTruthy();
  });
});

describe('search card (14, 19, 21, 22)', () => {
  const item: YoutubeSearchItem = { videoId: 'dQw4w9WgXcQ', title: NOISY, channelTitle: NOISY_CHANNEL, thumbnailUrl: null };

  it('shows the cleaned title + artist + TJ source, never the provider noise', () => {
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} saved={false} onToggleSave={vi.fn()} />);
    expect(screen.getByText('난')).toBeTruthy();
    expect(screen.getByText('옥주현')).toBeTruthy();
    expect(screen.getByText('TJ')).toBeTruthy();
    expect(screen.queryByText(/TJ노래방/)).toBeNull();
    expect(screen.queryByText(/TJ Karaoke/)).toBeNull();
  });

  it('the raw item is handed to request/save callbacks UNCHANGED (19/20)', () => {
    const onRequest = vi.fn();
    const onToggleSave = vi.fn();
    render(<RequestResultCard item={item} onRequest={onRequest} pending={false} saved={false} onToggleSave={onToggleSave} />);
    fireEvent.click(screen.getByRole('button', { name: /신청하기/ }));
    fireEvent.click(screen.getByRole('button', { name: /저장$/ }));
    expect(onRequest).toHaveBeenCalledWith(item); // raw title + videoId intact
    expect(onToggleSave).toHaveBeenCalledWith(item);
  });

  it('the title node uses the 2-line clamp and both controls remain visible (21/22)', () => {
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} saved={false} onToggleSave={vi.fn()} />);
    expect(screen.getByText('난').className).toContain('clamp-2');
    expect(screen.getByRole('button', { name: /저장$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /신청하기/ })).toBeTruthy();
  });
});

describe('My Songs + Recently Sung (15, 16)', () => {
  const saved: SavedSong[] = [{ videoId: 'dQw4w9WgXcQ', title: NOISY, artist: NOISY_CHANNEL, thumbnailUrl: null, savedAt: 2 }];
  const recent: RecentlySung[] = [{ requestId: 'r1', videoId: 'aaaaaaaaaaa', title: NOISY, artist: NOISY_CHANNEL, thumbnailUrl: null, sungAt: 1 }];
  const props = {
    isSaved: () => false,
    isSavePending: () => false,
    onToggleSave: vi.fn(),
    onRequestSaved: vi.fn(),
    onRemoveSaved: vi.fn(),
    canParticipate: true,
    requestPendingVideoId: null as string | null,
  };

  it('My Songs shows the cleaned title, not the raw provider string', () => {
    render(<MySongsSections {...props} saved={saved} recentlySung={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    expect(screen.getByText('난')).toBeTruthy();
    expect(screen.queryByText(/TJ노래방/)).toBeNull();
  });

  it('Recently Sung shows the cleaned title, not the raw provider string', () => {
    render(<MySongsSections {...props} saved={[]} recentlySung={recent} />);
    fireEvent.click(screen.getByRole('button', { name: /방금 부른 노래/ }));
    expect(screen.getByText('난')).toBeTruthy();
    expect(screen.queryByText(/TJ Karaoke/)).toBeNull();
  });
});

describe('public Queue + NOW SINGING (18)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.endsWith('/display')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            room: { name: 'R', slug: 'bty-home', open: true },
            playing: { id: 'p1', guestName: '한빛', title: NOISY, videoId: 'dQw4w9WgXcQ', videoKind: 'karaoke', thumbnailUrl: null, status: 'playing' },
            next: null,
            waiting: [{ id: 'w1', guestName: '민지', title: '난 - 클론 / TJ Karaoke', videoId: 'bbbbbbbbbbb', videoKind: 'karaoke', thumbnailUrl: null, status: 'waiting' }],
            waitingCount: 1,
            stats: { singers: 1, requests: 2, completed: 0, waiting: 1 },
            event: { id: 'e1', name: 'E', status: 'active' },
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it('NOW SINGING and waiting rows render cleaned titles', async () => {
    render(<QueueBoard slug="bty-home" eventId="e1" />);
    await waitFor(() => expect(screen.getAllByText('난').length).toBeGreaterThan(0));
    expect(screen.queryByText(/TJ노래방/)).toBeNull();
    expect(screen.queryByText(/TJ Karaoke/)).toBeNull();
  });
});

describe('own NOW SINGING in the dock (17)', () => {
  const req: MyRequest = { requestId: 'p1', cancelToken: 'cap', title: NOISY, artist: NOISY_CHANNEL, videoId: 'dQw4w9WgXcQ', submittedAt: Date.now() };

  beforeEach(() => {
    global.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (/\/requests\/p1$/.test(u)) {
        return {
          ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ status: { requestId: 'p1', state: 'now_playing', position: 0, aheadCount: 0, isUpNext: false, isNowPlaying: true, readyAt: null } }),
        } as unknown as Response;
      }
      if (u.endsWith('/display')) {
        return {
          ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ room: { name: 'R', slug: 'bty-home', open: true }, playing: { id: 'p1', guestName: '한빛', title: NOISY, videoId: 'dQw4w9WgXcQ', videoKind: 'karaoke', thumbnailUrl: null, status: 'playing' }, next: null, waiting: [], waitingCount: 0, stats: { singers: 1, requests: 1, completed: 0, waiting: 0 }, event: { id: 'e1', name: 'E', status: 'active' } }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it('own NOW SINGING perf-card shows the cleaned song title', async () => {
    render(<MyRequestsDock slug="bty-home" eventId="e1" requests={[req]} onRemoved={vi.fn()} isSaved={() => false} isSavePending={() => false} onToggleSave={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('지금 노래하는 중')).toBeTruthy());
    expect(screen.getByText('난')).toBeTruthy();
    expect(screen.queryByText(/TJ Karaoke/)).toBeNull();
  });
});
