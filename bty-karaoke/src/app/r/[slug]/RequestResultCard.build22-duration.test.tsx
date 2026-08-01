// @vitest-environment jsdom
//
// BUILD 22 — Guest web search result: duration visible, over-limit blocked, unknown selectable.
//
// The rule that carries the most risk here is the THIRD state. A result whose duration could not
// be established (older server, quota outage, enrichment failure) must remain requestable — if
// `unknown` rendered as blocked, a single YouTube incident would grey out every song in the room
// and the Guest would have no way to request anything at all.
//
// The second rule: the reason must be TEXT. A greyed button alone tells a Guest that something is
// wrong but not what, and not what to do instead.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import RequestResultCard from './RequestResultCard';
import type { YoutubeSearchItem } from '@/domain/youtube-search';

function item(over: Partial<YoutubeSearchItem> = {}): YoutubeSearchItem {
  return {
    videoId: 'dQw4w9WgXcQ',
    title: '너에게원한건',
    channelTitle: 'TJ노래방',
    thumbnailUrl: null,
    ...over,
  };
}

// Every query is scoped to THIS render's container, so one test can never observe another's DOM.
afterEach(cleanup);

function renderCard(over: Partial<YoutubeSearchItem> = {}) {
  const onRequest = vi.fn();
  // `.req-btn` is the always-visible request control (the swipe surface renders its own button,
  // so a role query alone is ambiguous). Both trigger the same action.
  const { container } = render(
    <RequestResultCard item={item(over)} onRequest={onRequest} pending={false} />,
  );
  return {
    onRequest,
    container,
    screen: within(container),
    button: container.querySelector('.req-btn') as HTMLButtonElement,
  };
}

describe('BUILD 22 — allowed results show their length and stay requestable', () => {
  it('renders the formatted duration', () => {
    const { screen } = renderCard({ durationSeconds: 185, durationAdmission: 'allowed' });
    expect(screen.getByText('3:05')).toBeTruthy();
  });

  it('renders 15:00 for the exact bound and keeps the request action enabled', () => {
    const { button, screen } = renderCard({ durationSeconds: 900, durationAdmission: 'allowed' });
    expect(screen.getByText('15:00')).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.textContent).toContain('신청');
  });

  it('invokes onRequest when tapped', () => {
    const { onRequest, button } = renderCard({ durationSeconds: 185, durationAdmission: 'allowed' });
    button.click();
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});

describe('BUILD 22 — a positively over-limit result is visibly blocked', () => {
  const OVER = { durationSeconds: 8917, durationAdmission: 'too_long' as const };

  it('disables the request action', () => {
    const { button } = renderCard(OVER);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.textContent).toContain('신청 불가');
  });

  it('never invokes onRequest, even on a direct click', () => {
    const { onRequest, button } = renderCard(OVER);
    button.click();
    expect(onRequest).not.toHaveBeenCalled();
  });

  // The accessibility rule: colour and a disabled attribute are not an explanation.
  it('states the reason in TEXT, naming the limit and the remedy', () => {
    const { screen } = renderCard(OVER);
    const note = screen.getByText(/15분을 초과해 신청할 수 없어요/);
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('더 짧은 버전');
  });

  it('carries the reason in the accessible name too', () => {
    const { button } = renderCard(OVER);
    expect(button.getAttribute('aria-label')).toContain('15분을 초과해 신청할 수 없습니다');
  });

  it('PRESERVES the result row so the Guest can see WHICH song was refused, and how long it is', () => {
    const { screen } = renderCard(OVER);
    expect(screen.getByText('너에게원한건')).toBeTruthy();
    expect(screen.getByText('2:28:37')).toBeTruthy();
  });
});

describe('BUILD 22 — unknown NEVER blocks (the outage-safety rule)', () => {
  it.each([
    ['an explicit unknown verdict', { durationAdmission: 'unknown' as const, durationSeconds: null }],
    ['a response with NO duration fields at all (older server)', {}],
    ['a null duration with no verdict', { durationSeconds: null }],
  ])('%s stays enabled and requestable', (_label, over) => {
    const { onRequest, button } = renderCard(over);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    button.click();
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it('never labels an unknown result as too long', () => {
    const { screen } = renderCard({ durationAdmission: 'unknown', durationSeconds: null });
    expect(screen.queryByText(/15분을 초과/)).toBeNull();
    expect(screen.queryByText('신청 불가')).toBeNull();
  });

  it('shows no fabricated 0:00 when the duration is unknown', () => {
    const { screen } = renderCard({ durationAdmission: 'unknown', durationSeconds: null });
    expect(screen.queryByText('0:00')).toBeNull();
  });
});
