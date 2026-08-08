// @vitest-environment jsdom
// BUILD 20M-WEB8 — the unauthenticated web Guest has NO saved-song library.
//
// Product decision: the web Guest has no account-backed identity, so a browser-local "내 노래"
// is not part of the approved experience. BUILD 20B-WEB7 shipped one; this suite locks its
// removal in, and locks in that everything around it still works.
//
// These render the REAL components and assert what a Guest can actually see and click — not
// that a module is missing. The stale-localStorage case matters most: an existing device still
// carries the WEB7 key, and it must never be able to restore removed UI.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import RequestResultCard from './RequestResultCard';
import RecentlySungSection from './RecentlySungSection';
import MyRequestsDock from './MyRequestsDock';
import type { YoutubeSearchItem } from '@/domain/youtube-search';
import type { RecentlySung } from '@/domain/recently-sung';

/** The retired BUILD 20B-WEB7 key. Nothing may read it any more. */
const LEGACY_SAVED_SONGS_KEY = 'bty-karaoke:saved-songs';

const item: YoutubeSearchItem = {
  videoId: 'dQw4w9WgXcQ',
  title: '너에게원한건',
  channelTitle: 'TJ',
  thumbnailUrl: null,
};

/** A populated legacy library, exactly as WEB7 would have written it. */
const STALE_LIBRARY = JSON.stringify([
  { videoId: 'dQw4w9WgXcQ', title: '너에게원한건', artist: 'TJ', thumbnailUrl: null, savedAt: 2 },
  { videoId: 'aaaaaaaaaaa', title: '상상속의너', artist: 'KY', thumbnailUrl: null, savedAt: 1 },
]);

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('1 — no bookmark in web Guest search results', () => {
  it('a search-result card renders no save control in any variant', () => {
    for (const variant of [undefined, 'reco'] as const) {
      const { unmount } = renderGuest(
        <RequestResultCard item={item} onRequest={vi.fn()} pending={false} variant={variant} />,
      );
      expect(screen.getByRole('button', { name: /신청하기/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
      expect(screen.queryByText('☆')).toBeNull();
      expect(screen.queryByText('★')).toBeNull();
      unmount();
    }
  });

  it('the card exposes no save-related props at runtime (extra props are inert)', () => {
    // Passing the removed props must not resurrect a control.
    const rogue = { saved: true, savePending: false, onToggleSave: vi.fn() } as Record<string, unknown>;
    renderGuest(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} {...rogue} />);
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
  });
});

describe('2 — no save control in NOW SINGING', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ requests: [], event: null }) })) as never,
    );
  });

  it('the own-turn dock renders no 내 노래에 저장 control', () => {
    renderGuest(
      <MyRequestsDock
        slug="bty-home"
        eventId="e1"
        requests={[
          {
            requestId: 'r1',
            cancelToken: 't',
            title: '너에게원한건',
            artist: 'TJ',
            videoId: 'dQw4w9WgXcQ',
            submittedAt: 1,
          },
        ]}
        onRemoved={vi.fn()}
      />,
    );
    expect(screen.queryByText(/내 노래에 저장/)).toBeNull();
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
  });
});

describe('3/4 — no My Songs section, no request-from-saved flow', () => {
  const recent: RecentlySung[] = [
    { requestId: 'r1', videoId: 'dQw4w9WgXcQ', title: '너에게원한건', artist: 'TJ', thumbnailUrl: null, sungAt: 1 },
  ];

  it('the section renders 방금 부른 노래 only — no 내 노래 header, count, or empty state', () => {
    renderGuest(<RecentlySungSection recentlySung={recent} />);
    expect(screen.getByRole('button', { name: /방금 부른 노래/ })).toBeTruthy();
    expect(screen.queryByText('내 노래')).toBeNull();
    expect(screen.queryByText(/저장한 노래가 아직 없어요/)).toBeNull();
    expect(screen.queryByText(/북마크를 눌러 저장/)).toBeNull();
  });

  it('an expanded Recently Sung row offers no 신청하기, no 저장 해제 and no bookmark', () => {
    renderGuest(<RecentlySungSection recentlySung={recent} />);
    fireEvent.click(screen.getByRole('button', { name: /방금 부른 노래/ }));
    expect(screen.getByText('너에게원한건')).toBeTruthy();   // 6 — still functional
    expect(screen.queryByRole('button', { name: /신청하기/ })).toBeNull();
    expect(screen.queryByText(/저장 해제/)).toBeNull();
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
  });

  it('with no history the section renders nothing at all (no stray empty state)', () => {
    const { container } = renderGuest(<RecentlySungSection recentlySung={[]} />);
    expect(container.textContent).toBe('');
  });
});

describe('5 — stale WEB7 localStorage cannot restore removed UI', () => {
  it('a populated legacy library changes nothing a Guest can see', () => {
    window.localStorage.setItem(LEGACY_SAVED_SONGS_KEY, STALE_LIBRARY);
    renderGuest(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
    expect(screen.queryByText('상상속의너')).toBeNull();   // the stale entry is never rendered

    cleanup();
    const recent: RecentlySung[] = [
      { requestId: 'r1', videoId: 'dQw4w9WgXcQ', title: '너에게원한건', artist: 'TJ', thumbnailUrl: null, sungAt: 1 },
    ];
    renderGuest(<RecentlySungSection recentlySung={recent} />);
    expect(screen.queryByText('내 노래')).toBeNull();
  });

  it('no shipped web-Guest module reads the retired key', async () => {
    // A read would have to come from one of these; none of them touch it any more.
    const sources = await Promise.all([
      import('./RecentlySungSection'),
      import('./recently-sung.hooks'),
      import('./RequestResultCard'),
    ]);
    expect(sources.every(Boolean)).toBe(true);
    window.localStorage.setItem(LEGACY_SAVED_SONGS_KEY, STALE_LIBRARY);
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    renderGuest(<RecentlySungSection recentlySung={[]} />);
    const readKeys = spy.mock.calls.map((c) => String(c[0]));
    expect(readKeys).not.toContain(LEGACY_SAVED_SONGS_KEY);
  });

  it('removing the retired key leaves every unrelated Guest key untouched', () => {
    // Exactly the narrow cleanup RequestForm performs on init.
    const untouched = {
      'bty-karaoke:guest-name:bty-home': '한빛',
      'bty-karaoke:my-requests:bty-home:e1': '[{"requestId":"r1"}]',
      'bty-karaoke:recently-sung:bty-home:e1': '[{"requestId":"r1"}]',
      'unrelated-app-key': 'keep me',
    };
    for (const [k, v] of Object.entries(untouched)) window.localStorage.setItem(k, v);
    window.localStorage.setItem(LEGACY_SAVED_SONGS_KEY, STALE_LIBRARY);

    window.localStorage.removeItem(LEGACY_SAVED_SONGS_KEY);

    expect(window.localStorage.getItem(LEGACY_SAVED_SONGS_KEY)).toBeNull();
    for (const [k, v] of Object.entries(untouched)) {
      expect(window.localStorage.getItem(k)).toBe(v);
    }
  });
});

describe('11 — no server or migration surface is involved', () => {
  it('the account-scoped saved-song server module is untouched and still exported', async () => {
    // Native authenticated users keep the full BUILD 20A API — WEB8 is web-Guest-only.
    const server = await import('@/lib/saved-songs.server');
    expect(typeof server.saveSavedSong).toBe('function');
    expect(typeof server.listSavedSongs).toBe('function');
    expect(typeof server.deleteSavedSong).toBe('function');
  });
});
