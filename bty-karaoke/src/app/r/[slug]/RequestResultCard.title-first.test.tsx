// @vitest-environment jsdom
//
// BUILD 20B-R5 — the hard title-first VIEW contract on the exact component that
// renders search cards. Asserts DOM ORDER (title → artist → source → actions), that
// no raw provider node precedes the title, that the raw channel line is absent, and
// that request/save callbacks still receive the RAW item unchanged.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RequestResultCard from './RequestResultCard';
import type { YoutubeSearchItem } from '@/domain/youtube-search';

const item: YoutubeSearchItem = {
  videoId: 'dQw4w9WgXcQ',
  title: '[TJ노래방] 영원한사랑 - 핑클 / TJ Karaoke',
  channelTitle: 'TJ노래방 공식 유튜브채널',
  thumbnailUrl: null,
};

afterEach(cleanup);

const FORBIDDEN_FIRST = /^(?:\[?TJ|\[?KY|금영|노래방|MR\s*노래방|Karaoke)/i;

describe('RequestResultCard — title-first view contract', () => {
  it('the FIRST primary text node is the clean title, never provider text', () => {
    const { container } = render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    const titleEl = container.querySelector('.req-card .grow .title') as HTMLElement;
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toBe('영원한사랑');
    expect(FORBIDDEN_FIRST.test(titleEl.textContent!)).toBe(false);
  });

  it('renders title → artist → source badge in DOM order', () => {
    const { container } = render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    const grow = container.querySelector('.req-card .grow') as HTMLElement;
    const texts = Array.from(grow.querySelectorAll('.title, .song-artist, .src-badge')).map(
      (n) => `${n.className.split(' ')[0]}:${n.textContent}`,
    );
    expect(texts).toEqual(['title:영원한사랑', 'song-artist:핑클', 'src-badge:TJ']);
  });

  it('the raw provider channel line is NOT rendered anywhere visible', () => {
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    expect(screen.queryByText('TJ노래방 공식 유튜브채널')).toBeNull();
    expect(screen.queryByText(/TJ Karaoke/)).toBeNull();
    expect(screen.queryByText('[TJ노래방] 영원한사랑 - 핑클 / TJ Karaoke')).toBeNull();
  });

  it('suppresses the generic 노래방 category badge when a compact source label exists', () => {
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    // exactly one compact indicator: TJ, not a redundant 노래방 vk-badge
    expect(screen.getByText('TJ')).toBeTruthy();
    expect(screen.queryByText(/노래방/)).toBeNull();
  });

  it('the request callback receives the RAW item unchanged (16, 17)', () => {
    const onRequest = vi.fn();
    render(<RequestResultCard item={item} onRequest={onRequest} pending={false} />);
    fireEvent.click(screen.getByRole('button', { name: /신청하기/ }));
    expect(onRequest).toHaveBeenCalledWith(item);
    expect(onRequest.mock.calls[0][0].title).toBe('[TJ노래방] 영원한사랑 - 핑클 / TJ Karaoke');
    // BUILD 20M-WEB8 — no bookmark exists on the web Guest card at all.
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
  });
});
