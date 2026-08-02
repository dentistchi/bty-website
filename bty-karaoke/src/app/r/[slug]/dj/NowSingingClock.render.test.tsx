// @vitest-environment jsdom
//
// BUILD 24 — the current-song clock renders the pure projection and nothing else. These cover
// the HONESTY rules specifically: what the operator is allowed to be shown in each state.
//
// The defect this component answers was reported as "the current-song time is frozen at 2:42".
// Forensics found no clock existed at all — 2:42 was a static song-LENGTH badge. So the tests
// that matter are the ones proving a rendered number is only ever shown when it is genuinely
// live, and that an unknown duration is never dressed up as a countdown.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NowSingingClock from './NowSingingClock';
import { makeAnchor, projectSongClock, projectLeaseWindow } from '@/domain/playback-clock';

const T0 = '2026-08-02T11:30:00.000Z';
const anchor = (over: Record<string, unknown> = {}) =>
  makeAnchor({
    requestId: 'req-A',
    serverNow: T0,
    startedAt: T0,
    durationSeconds: 162,
    leaseEndsAt: null,
    monotonicNowMs: 0,
    ...over,
  })!;

/** Render the component at a chosen number of monotonic milliseconds past the anchor. */
function renderAt(a: ReturnType<typeof anchor>, isPlaying: boolean, deltaMs: number) {
  return render(
    <NowSingingClock song={projectSongClock(a, isPlaying, deltaMs)} lease={projectLeaseWindow(a, deltaMs)} />,
  );
}

afterEach(() => cleanup());

describe('NowSingingClock', () => {
  it('renders nothing when nothing is on stage and no lease is open', () => {
    const { container } = renderAt(anchor(), false, 0);
    expect(container.firstChild).toBeNull();
  });

  it('shows elapsed / total and the remaining time while a song plays', () => {
    renderAt(anchor(), true, 0);
    const el = screen.getByRole('timer');
    expect(el.textContent).toContain('0:00');
    expect(el.textContent).toContain('2:42'); // the song's own length
    expect(el.textContent).toContain('남은 시간 2:42');
  });

  it('the displayed value ADVANCES across 15 seconds with no new response (G1)', () => {
    const a = anchor();
    const { unmount } = renderAt(a, true, 0);
    const first = screen.getByRole('timer').textContent!;
    unmount();
    renderAt(a, true, 15_000);
    const later = screen.getByRole('timer').textContent!;
    expect(first).not.toBe(later);
    expect(later).toContain('0:15');
    expect(later).toContain('남은 시간 2:27');
  });

  it('an unknown duration shows real elapsed time and NO invented countdown', () => {
    renderAt(anchor({ durationSeconds: null }), true, 30_000);
    const el = screen.getByRole('timer');
    expect(el.textContent).toContain('0:30');
    expect(el.textContent).toContain('영상 길이를 알 수 없어');
    // It may SAY the remaining time is unshowable; it must never show a remaining VALUE, and
    // must never fall back to "0:00" — a zero would read as "this song just ended".
    expect(el.textContent).not.toMatch(/남은 시간\s*\d/);
    expect(el.textContent).not.toContain('0:00');
    // Exactly one clock value on screen: the elapsed one.
    expect(el.textContent!.match(/\d+:\d{2}/g)).toEqual(['0:30']);
  });

  it('past the song length it says so instead of pinning a 0:00 countdown that reads as live', () => {
    renderAt(anchor(), true, 200_000);
    const el = screen.getByRole('timer');
    expect(el.textContent).toContain('곡 길이를 지났어요');
    expect(el.textContent).not.toContain('남은 시간');
  });

  it('the clock disappears the moment the server stops reporting a song on stage', () => {
    const { container } = renderAt(anchor(), false, 90_000);
    expect(container.querySelector('[role="timer"]')).toBeNull();
  });

  it('a new request renders ITS duration, never the previous one', () => {
    renderAt(anchor({ requestId: 'req-B', durationSeconds: 200 }), true, 0);
    expect(screen.getByRole('timer').textContent).toContain('3:20');
  });

  it('never renders a negative time however far past the end', () => {
    renderAt(anchor(), true, 10_000_000);
    expect(screen.getByRole('timer').textContent).not.toMatch(/-\d/);
  });

  describe('external-playback lease note', () => {
    const leased = () => anchor({ leaseEndsAt: '2026-08-02T11:33:00.000Z' });

    it('counts down the authorized window while a song plays', () => {
      const { container } = renderAt(leased(), true, 15_000);
      expect(container.querySelector('.now-clock-lease')!.textContent).toContain('2:45');
    });

    it('survives Finish — a lease is non-shrinkable, so it shows with nothing on stage', () => {
      const { container } = renderAt(leased(), false, 10_000);
      expect(container.querySelector('[role="timer"]')).toBeNull();
      expect(container.querySelector('.now-clock-lease')!.textContent).toContain('2:50');
    });

    it('disappears once the authorized window has elapsed', () => {
      const { container } = renderAt(leased(), false, 200_000);
      expect(container.firstChild).toBeNull();
    });

    it('never claims YouTube is definitely still playing — only that time is authorized', () => {
      const { container } = renderAt(leased(), true, 0);
      const text = container.textContent!;
      expect(text).toContain('YouTube에 허용된 재생 시간');
      expect(text).not.toContain('재생 중입니다');
    });
  });

  it('exposes both states as data attributes for the device gates', () => {
    const { container } = renderAt(anchor({ leaseEndsAt: '2026-08-02T11:33:00.000Z' }), true, 0);
    const el = container.querySelector('.now-clock')!;
    expect(el.getAttribute('data-song-state')).toBe('playing');
    expect(el.getAttribute('data-lease-state')).toBe('open');
  });
});
