// @vitest-environment jsdom
//
// BUILD 20B-WEB7 — the search-result bookmark. Save and 신청하기 are independent:
// saving must never place a request, and requesting must never toggle the bookmark.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RequestResultCard from './RequestResultCard';
import type { YoutubeSearchItem } from '@/domain/youtube-search';

const item: YoutubeSearchItem = {
  videoId: 'dQw4w9WgXcQ',
  title: '밤편지',
  channelTitle: '아이유',
  thumbnailUrl: null,
};

afterEach(cleanup);

describe('RequestResultCard bookmark', () => {
  it('renders a bookmark control that is independent from 신청하기', () => {
    const onRequest = vi.fn();
    const onToggleSave = vi.fn();
    render(
      <RequestResultCard item={item} onRequest={onRequest} pending={false} saved={false} onToggleSave={onToggleSave} />,
    );
    const save = screen.getByRole('button', { name: /저장$/ });
    fireEvent.click(save);
    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onRequest).not.toHaveBeenCalled(); // save creates NO request
  });

  it('requesting does not toggle the bookmark', () => {
    const onRequest = vi.fn();
    const onToggleSave = vi.fn();
    render(
      <RequestResultCard item={item} onRequest={onRequest} pending={false} saved={false} onToggleSave={onToggleSave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /신청하기/ }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onToggleSave).not.toHaveBeenCalled();
  });

  it('reflects saved state (★, aria-pressed) and shows 저장 해제 affordance', () => {
    render(
      <RequestResultCard item={item} onRequest={vi.fn()} pending={false} saved onToggleSave={vi.fn()} />,
    );
    const save = screen.getByRole('button', { name: /저장 해제/ });
    expect(save.getAttribute('aria-pressed')).toBe('true');
  });

  it('no bookmark control when onToggleSave is not provided (legacy callers)', () => {
    render(<RequestResultCard item={item} onRequest={vi.fn()} pending={false} />);
    expect(screen.queryByRole('button', { name: /저장/ })).toBeNull();
  });
});
