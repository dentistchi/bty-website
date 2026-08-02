// BUILD 24 — authority tests for the live playback clock projection.
//
// Every case runs on an INJECTED monotonic clock. There are no real-time sleeps: "15 seconds of
// playback" is a number passed to the projection, so the suite is deterministic and instant.
import { describe, it, expect } from 'vitest';
import {
  makeAnchor,
  shouldReplaceAnchor,
  projectSongClock,
  projectLeaseWindow,
  freeRemainingForDisplay,
  formatClock,
  toGuestPlaybackAuthority,
  type PlaybackAnchor,
  type PlaybackAuthorityWire,
} from './playback-clock';

/** A canonical poll: server says request R started 0s ago, duration 162s ("2:42"). */
const T0 = '2026-08-02T11:30:00.000Z';
const anchorAt = (over: Partial<Parameters<typeof makeAnchor>[0]> = {}) =>
  makeAnchor({
    requestId: 'req-A',
    serverNow: T0,
    startedAt: T0,
    durationSeconds: 162,
    leaseEndsAt: null,
    monotonicNowMs: 1_000_000,
    ...over,
  })!;

describe('makeAnchor', () => {
  it('builds from a complete canonical response', () => {
    const a = anchorAt();
    expect(a.requestId).toBe('req-A');
    expect(a.durationSeconds).toBe(162);
    expect(a.serverNowMs).toBe(Date.parse(T0));
  });

  it('returns null when nothing is on stage or the server omitted the timestamps', () => {
    expect(makeAnchor({ requestId: null, serverNow: T0, startedAt: T0, durationSeconds: 162, monotonicNowMs: 0 })).toBeNull();
    expect(makeAnchor({ requestId: 'r', serverNow: null, startedAt: T0, durationSeconds: 162, monotonicNowMs: 0 })).toBeNull();
    expect(makeAnchor({ requestId: 'r', serverNow: T0, startedAt: null, durationSeconds: 162, monotonicNowMs: 0 })).toBeNull();
    expect(makeAnchor({ requestId: 'r', serverNow: 'not-a-date', startedAt: T0, durationSeconds: 1, monotonicNowMs: 0 })).toBeNull();
  });

  it('treats an absent, zero, or out-of-bounds duration as unresolved rather than a clock', () => {
    for (const d of [null, undefined, 0, -5, 901, NaN]) {
      expect(anchorAt({ durationSeconds: d as number | null }).durationSeconds).toBeNull();
    }
    expect(anchorAt({ durationSeconds: 900 }).durationSeconds).toBe(900); // the exact limit is valid
  });
});

describe('active playback advances', () => {
  it('ticks forward from the anchor without any new network response', () => {
    const a = anchorAt();
    const at = (deltaMs: number) => projectSongClock(a, true, a.monotonicAtReceiptMs + deltaMs);

    expect(at(0)).toMatchObject({ state: 'playing', elapsedSeconds: 0, remainingSeconds: 162 });
    expect(at(1_000)).toMatchObject({ elapsedSeconds: 1, remainingSeconds: 161 });
    // G1 requires a VISIBLE change across 15 seconds with no refresh.
    expect(at(15_000)).toMatchObject({ elapsedSeconds: 15, remainingSeconds: 147 });
    expect(at(60_000)).toMatchObject({ elapsedSeconds: 60, remainingSeconds: 102 });
  });

  it('accounts for time already elapsed on the server before the response landed', () => {
    // Joining mid-song: the server says 40s have already passed.
    const a = anchorAt({ serverNow: '2026-08-02T11:30:40.000Z' });
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs)).toMatchObject({ elapsedSeconds: 40, remainingSeconds: 122 });
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 5_000)).toMatchObject({ elapsedSeconds: 45, remainingSeconds: 117 });
  });
});

describe('inactive playback does not advance', () => {
  it('is idle the moment the server stops reporting a song on stage', () => {
    const a = anchorAt();
    expect(projectSongClock(a, false, a.monotonicAtReceiptMs + 90_000)).toEqual({ state: 'idle' });
  });

  it('is idle with no anchor at all', () => {
    expect(projectSongClock(null, true, 123)).toEqual({ state: 'idle' });
  });
});

describe('request change resets projection', () => {
  it('a different request always replaces the anchor, even with an older serverNow', () => {
    const a = anchorAt();
    const b = anchorAt({ requestId: 'req-B', serverNow: '2026-08-02T11:29:00.000Z', startedAt: '2026-08-02T11:29:00.000Z' });
    expect(shouldReplaceAnchor(a, b)).toBe(true);
  });

  it('the new song starts from ITS own duration, not the old one', () => {
    const b = anchorAt({ requestId: 'req-B', durationSeconds: 200 });
    expect(projectSongClock(b, true, b.monotonicAtReceiptMs)).toMatchObject({
      requestId: 'req-B', elapsedSeconds: 0, remainingSeconds: 200, durationSeconds: 200,
    });
  });
});

describe('server poll reconciles drift', () => {
  it('a fresh anchor for the same request pulls the display back to server truth', () => {
    const a = anchorAt();
    // The device believes 100s have passed; the server says only 90s have.
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 100_000)).toMatchObject({ elapsedSeconds: 100 });
    const corrected = anchorAt({ serverNow: '2026-08-02T11:31:30.000Z', monotonicNowMs: a.monotonicAtReceiptMs + 100_000 });
    expect(shouldReplaceAnchor(a, corrected)).toBe(true);
    expect(projectSongClock(corrected, true, corrected.monotonicAtReceiptMs)).toMatchObject({ elapsedSeconds: 90 });
  });

  it('converges immediately rather than easing, so no stale value lingers', () => {
    const a = anchorAt({ serverNow: '2026-08-02T11:32:00.000Z' }); // server: 120s in
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs)).toMatchObject({ elapsedSeconds: 120, remainingSeconds: 42 });
  });
});

describe('stale response cannot overwrite newer request state', () => {
  it('rejects an out-of-order poll for the same request', () => {
    const fresh = anchorAt({ serverNow: '2026-08-02T11:30:20.000Z' });
    const stale = anchorAt({ serverNow: '2026-08-02T11:30:05.000Z' });
    expect(shouldReplaceAnchor(fresh, stale)).toBe(false);
  });

  it('rejects a duplicate of the same instant (no forward information)', () => {
    const a = anchorAt();
    expect(shouldReplaceAnchor(a, anchorAt())).toBe(false);
  });

  it('accepts any strictly newer response for the same request', () => {
    const a = anchorAt();
    expect(shouldReplaceAnchor(a, anchorAt({ serverNow: '2026-08-02T11:30:01.000Z' }))).toBe(true);
  });

  it('always accepts the first anchor', () => {
    expect(shouldReplaceAnchor(null, anchorAt())).toBe(true);
  });
});

describe('background/foreground and browser sleep recalculate correctly', () => {
  it('a long monotonic jump lands on the right value, not a frozen one', () => {
    const a = anchorAt();
    // Tab slept for 100s. The next render — before any poll — must already be correct.
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 100_000)).toMatchObject({ elapsedSeconds: 100, remainingSeconds: 62 });
  });

  it('a sleep longer than the song clamps to the end instead of running negative', () => {
    const a = anchorAt();
    const c = projectSongClock(a, true, a.monotonicAtReceiptMs + 10 * 60_000);
    expect(c).toMatchObject({ state: 'playing', elapsedSeconds: 162, remainingSeconds: 0, overrun: true });
  });

  it('a monotonic clock that did NOT advance while suspended simply shows the anchor value', () => {
    // iOS uptimeNanoseconds can pause in deep sleep; the value stays truthful for the anchor and
    // the foreground poll re-anchors. It must never go backwards.
    const a = anchorAt();
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs)).toMatchObject({ elapsedSeconds: 0 });
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs - 5_000)).toMatchObject({ elapsedSeconds: 0 });
  });
});

describe('client wall-clock change does not corrupt projection', () => {
  it('projection depends only on the server anchor and monotonic delta', () => {
    const a = anchorAt();
    const before = projectSongClock(a, true, a.monotonicAtReceiptMs + 10_000);
    // Simulate the user moving the device clock a year forward: nothing in the projection reads
    // Date.now(), so the SAME inputs give the SAME answer.
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 365 * 24 * 3600 * 1000;
      expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 10_000)).toEqual(before);
      expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 10_000)).toEqual({ state: 'none' });
    } finally {
      Date.now = realNow;
    }
  });
});

describe('unknown duration remains honest', () => {
  it('shows a real elapsed time but never invents a countdown', () => {
    const a = anchorAt({ durationSeconds: null });
    const c = projectSongClock(a, true, a.monotonicAtReceiptMs + 30_000);
    expect(c).toEqual({ state: 'unknown_duration', requestId: 'req-A', elapsedSeconds: 30 });
    expect(c).not.toHaveProperty('remainingSeconds');
  });
});

describe('negative values clamp to zero', () => {
  it('a startedAt in the future cannot produce a negative elapsed', () => {
    const a = anchorAt({ startedAt: '2026-08-02T11:35:00.000Z' }); // 5 min AFTER serverNow
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs)).toMatchObject({ elapsedSeconds: 0, remainingSeconds: 162 });
  });

  it('remaining never goes below zero however far past the end', () => {
    const a = anchorAt();
    for (const d of [162_000, 200_000, 10_000_000]) {
      expect(projectSongClock(a, true, a.monotonicAtReceiptMs + d)).toMatchObject({ remainingSeconds: 0 });
    }
  });

  it('flags overrun rather than pretending the countdown still runs', () => {
    const a = anchorAt();
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 161_000)).toMatchObject({ overrun: false });
    expect(projectSongClock(a, true, a.monotonicAtReceiptMs + 163_000)).toMatchObject({ overrun: true });
  });
});

describe('lease window projection', () => {
  const withLease = (leaseEndsAt: string | null) => anchorAt({ leaseEndsAt });

  it('reports no lease when the server sent none', () => {
    expect(projectLeaseWindow(withLease(null), 1_000_000)).toEqual({ state: 'none' });
    expect(projectLeaseWindow(null, 1_000_000)).toEqual({ state: 'none' });
  });

  it('counts down the authorized external-playback window', () => {
    const a = withLease('2026-08-02T11:33:00.000Z'); // 180s out
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs)).toEqual({ state: 'open', remainingSeconds: 180 });
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 15_000)).toEqual({ state: 'open', remainingSeconds: 165 });
  });

  it('survives Finish — a lease is non-shrinkable, so it can be open with nothing on stage', () => {
    const a = withLease('2026-08-02T11:33:00.000Z');
    expect(projectSongClock(a, false, a.monotonicAtReceiptMs + 10_000)).toEqual({ state: 'idle' });
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 10_000)).toEqual({ state: 'open', remainingSeconds: 170 });
  });

  it('reports elapsed at and past the boundary, never a negative window', () => {
    const a = withLease('2026-08-02T11:30:30.000Z');
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 29_000)).toEqual({ state: 'open', remainingSeconds: 1 });
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 30_000)).toEqual({ state: 'elapsed' });
    expect(projectLeaseWindow(a, a.monotonicAtReceiptMs + 600_000)).toEqual({ state: 'elapsed' });
  });
});

describe('FREE balance is not projected (no double-charge)', () => {
  it('displays exactly the persisted server balance', () => {
    expect(freeRemainingForDisplay(738)).toBe(738);
    expect(freeRemainingForDisplay(0)).toBe(0);
  });

  it('never exceeds the canonical balance and never goes below zero', () => {
    expect(freeRemainingForDisplay(-30)).toBe(0);
    expect(freeRemainingForDisplay(900)).toBe(900);
  });

  it('has no time input at all — the value cannot drift, tick, or double-charge', () => {
    // The signature takes no clock. This is the guard: BUILD 20M debits the whole union
    // extension at admission, so any elapsed-time term here would charge the display twice.
    expect(freeRemainingForDisplay.length).toBe(1);
  });

  it('shows no FREE countdown for PRO', () => {
    expect(freeRemainingForDisplay(null)).toBeNull();
  });

  it('stays put across a whole song while the song clock advances', () => {
    const a = anchorAt();
    const persisted = 738; // 900 - 162, already debited at admission
    for (const d of [0, 15_000, 60_000, 162_000]) {
      expect(freeRemainingForDisplay(persisted)).toBe(738);
      expect(projectSongClock(a, true, a.monotonicAtReceiptMs + d).state).toBe('playing');
    }
  });
});

describe('formatClock', () => {
  it('renders mm:ss, and h:mm:ss past an hour', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(162)).toBe('2:42');
    expect(formatClock(900)).toBe('15:00');
    expect(formatClock(3661)).toBe('1:01:01');
  });

  it('never renders a negative or fractional clock', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(1.9)).toBe('0:01');
  });
});

describe('guest-safe narrowing never leaks metering state', () => {
  const wire: PlaybackAuthorityWire = {
    serverNow: T0,
    requestId: 'req-A',
    startedAt: T0,
    durationSeconds: 162,
    leaseEndsAt: '2026-08-02T11:33:00.000Z',
  };

  it('drops leaseEndsAt', () => {
    const g = toGuestPlaybackAuthority(wire);
    expect(g).not.toHaveProperty('leaseEndsAt');
    expect(Object.keys(g).sort()).toEqual(['durationSeconds', 'requestId', 'serverNow', 'startedAt']);
  });

  it('keeps everything a Guest needs to render the SAME song clock as the Host', () => {
    const g = toGuestPlaybackAuthority(wire);
    expect(g).toEqual({ serverNow: T0, requestId: 'req-A', startedAt: T0, durationSeconds: 162 });
    // §6.5 — identical inputs must produce an identical projection on both sides.
    const host = makeAnchor({ ...wire, monotonicNowMs: 500 })!;
    const guest = makeAnchor({ ...g, leaseEndsAt: null, monotonicNowMs: 500 })!;
    expect(projectSongClock(guest, true, 15_500)).toEqual(projectSongClock(host, true, 15_500));
  });

  it('a Guest can never project a lease window (it is not given one)', () => {
    const guest = makeAnchor({ ...toGuestPlaybackAuthority(wire), monotonicNowMs: 0 })!;
    expect(projectLeaseWindow(guest, 10_000)).toEqual({ state: 'none' });
  });

  it('is an allowlist — an added private field is absent until explicitly published', () => {
    const withSecret = { ...wire, chargedSeconds: 999 } as PlaybackAuthorityWire;
    expect(toGuestPlaybackAuthority(withSecret)).not.toHaveProperty('chargedSeconds');
  });
});

describe('anchor is a plain value (safe to hold in client state)', () => {
  it('carries no functions and no live clock reference', () => {
    const a: PlaybackAnchor = anchorAt();
    expect(Object.values(a).every((v) => v === null || typeof v === 'string' || typeof v === 'number')).toBe(true);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});
