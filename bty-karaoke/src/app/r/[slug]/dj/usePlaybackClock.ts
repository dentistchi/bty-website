'use client';

// BUILD 24 — the web Host's live playback clock. Presentation only.
//
// All the arithmetic lives in `domain/playback-clock` (pure, fake-clock tested). This hook does
// exactly three things and no business logic of its own:
//
//   1. re-anchors on every canonical poll, through `shouldReplaceAnchor` so a stale/out-of-order
//      response can never drag the clock backwards and a song change resets it immediately;
//   2. re-renders once a second between polls, so the displayed time visibly advances WITHOUT a
//      network response per second and without a one-second write anywhere;
//   3. recomputes the instant the tab becomes visible again, so a slept tab shows the correct
//      value on its first painted frame rather than the value it froze at.
//
// The tick is `performance.now()` — MONOTONIC. Changing the device wall clock cannot move any
// displayed number (§6.4), and the projection re-converges on server truth every poll.

import { useEffect, useRef, useState } from 'react';
import {
  makeAnchor,
  shouldReplaceAnchor,
  projectSongClock,
  projectLeaseWindow,
  type PlaybackAnchor,
  type PlaybackAuthorityWire,
  type SongClock,
  type LeaseWindow,
} from '@/domain/playback-clock';

export interface PlaybackClockState {
  song: SongClock;
  lease: LeaseWindow;
}

const IDLE: PlaybackClockState = { song: { state: 'idle' }, lease: { state: 'none' } };

/**
 * @param authority the `playback` anchor from the latest /dj/queue poll (undefined on an older
 *                  server — the hook then renders nothing rather than inventing a clock)
 * @param isPlaying the SERVER's answer to "is a song on stage", derived from the canonical
 *                  queue. The hook never decides this itself.
 */
export function usePlaybackClock(
  authority: PlaybackAuthorityWire | null | undefined,
  isPlaying: boolean,
): PlaybackClockState {
  const anchorRef = useRef<PlaybackAnchor | null>(null);
  const [state, setState] = useState<PlaybackClockState>(IDLE);

  // Re-anchor on each poll. Kept in a ref (not state) so accepting an anchor does not itself
  // trigger a render — the tick below is the single render driver.
  const serverNow = authority?.serverNow ?? null;
  const requestId = authority?.requestId ?? null;
  useEffect(() => {
    if (!authority) {
      anchorRef.current = null;
      return;
    }
    const next = makeAnchor({ ...authority, monotonicNowMs: performance.now() });
    if (next && shouldReplaceAnchor(anchorRef.current, next)) {
      anchorRef.current = next;
    } else if (!next) {
      // Nothing on stage and no lease timestamps — drop the anchor so the clock disappears
      // rather than continuing to count against a request that is no longer current.
      anchorRef.current = null;
    }
    // `authority` is a fresh object every poll; depend on the values that actually matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverNow, requestId, authority?.startedAt, authority?.durationSeconds, authority?.leaseEndsAt]);

  useEffect(() => {
    const recompute = () => {
      const a = anchorRef.current;
      const now = performance.now();
      const next: PlaybackClockState = a
        ? { song: projectSongClock(a, isPlaying, now), lease: projectLeaseWindow(a, now) }
        : IDLE;
      // Only re-render when a DISPLAYED value actually changed. A 1s tick that produces the same
      // mm:ss must not re-render the whole board on top of a 4s poll.
      setState((prev) => (sameState(prev, next) ? prev : next));
    };
    recompute();
    const t = window.setInterval(recompute, 1000);
    const onVisible = () => {
      if (!document.hidden) recompute();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isPlaying, serverNow, requestId]);

  return state;
}

/** Structural equality over the two small projections (cheaper and clearer than JSON compare). */
function sameState(a: PlaybackClockState, b: PlaybackClockState): boolean {
  const s1 = a.song;
  const s2 = b.song;
  if (s1.state !== s2.state) return false;
  if (s1.state === 'playing' && s2.state === 'playing') {
    if (s1.requestId !== s2.requestId || s1.elapsedSeconds !== s2.elapsedSeconds || s1.overrun !== s2.overrun) return false;
  }
  if (s1.state === 'unknown_duration' && s2.state === 'unknown_duration') {
    if (s1.requestId !== s2.requestId || s1.elapsedSeconds !== s2.elapsedSeconds) return false;
  }
  const l1 = a.lease;
  const l2 = b.lease;
  if (l1.state !== l2.state) return false;
  if (l1.state === 'open' && l2.state === 'open' && l1.remainingSeconds !== l2.remainingSeconds) return false;
  return true;
}
