// BUILD 22 — the duration admission policy, pinned at the boundary.
//
// The 900/901 boundary is proven HERE, with numbers, and deliberately not on a device: finding
// public YouTube videos of exactly 900 and 901 seconds is not a repeatable verification, and a
// device gate that cannot be re-run is not a gate. The device gates prove the JOURNEY; this file
// proves the RULE.
//
// The rule that is easiest to get wrong, and the one this file exists to defend: `unknown` must
// never collapse into `too_long`. A quota outage, a network failure, a malformed payload and a
// zero-length response are all "we do not know" — and treating any of them as a length claim
// would disable every result in the room during a YouTube incident.

import { describe, it, expect } from 'vitest';
import {
  classifyDurationAdmission,
  formatDurationLabel,
  isTooLong,
  MAX_REQUESTABLE_DURATION_SECONDS,
} from './duration-admission';
import { MAX_LEASE_SECONDS } from './playback-lease';

describe('BUILD 22 — the bound is the canonical one, never a second copy of 900', () => {
  it('re-exports the playback-lease bound by identity', () => {
    expect(MAX_REQUESTABLE_DURATION_SECONDS).toBe(MAX_LEASE_SECONDS);
    expect(MAX_REQUESTABLE_DURATION_SECONDS).toBe(900);
  });
});

describe('BUILD 22 — allowed / too_long boundary', () => {
  it.each([
    [1, 'the shortest possible song'],
    [185, 'an ordinary song'],
    [899, 'one second below the bound'],
    [900, 'the bound itself — INCLUSIVE, never blocked'],
  ])('%d seconds → allowed (%s)', (secs) => {
    expect(classifyDurationAdmission(secs)).toBe('allowed');
    expect(isTooLong(secs)).toBe(false);
  });

  it.each([
    [901, 'one second past the bound'],
    [1200, 'a 20-minute video'],
    [8917, 'the real 2.5-hour medley measured in production'],
    [86400, 'the storage ceiling'],
  ])('%d seconds → too_long (%s)', (secs) => {
    expect(classifyDurationAdmission(secs)).toBe('too_long');
    expect(isTooLong(secs)).toBe(true);
  });

  // MUTATION GUARD: flipping the comparison to `>=` makes 900 too_long and fails here.
  it('900 is ALLOWED and 901 is TOO_LONG — the exact discriminating pair', () => {
    expect(classifyDurationAdmission(900)).toBe('allowed');
    expect(classifyDurationAdmission(901)).toBe('too_long');
  });
});

describe('BUILD 22 — unknown absorbs every non-length, and NEVER becomes too_long', () => {
  it.each<[number | null | undefined, string]>([
    [null, 'no value'],
    [undefined, 'absent'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
    [0, 'zero — not a length'],
    [-1, 'negative'],
    [-8917, 'a negative that is large in magnitude'],
    [185.5, 'a fractional value the provider contract cannot produce'],
  ])('%s → unknown (%s)', (value) => {
    expect(classifyDurationAdmission(value)).toBe('unknown');
    expect(isTooLong(value)).toBe(false);
  });

  // MUTATION GUARD: treating unknown as too_long fails every assertion here.
  it('a huge NEGATIVE magnitude is unknown, not too_long', () => {
    expect(classifyDurationAdmission(-99999)).toBe('unknown');
  });
});

describe('BUILD 22 — client-side duration formatting', () => {
  it.each([
    [185, '3:05'],
    [900, '15:00'],
    [901, '15:01'],
    [3661, '1:01:01'],
    [59, '0:59'],
    [60, '1:00'],
    [3600, '1:00:00'],
    [8917, '2:28:37'],
  ])('%d → %s', (secs, expected) => {
    expect(formatDurationLabel(secs)).toBe(expected);
  });

  it.each([null, undefined, 0, -5, Number.NaN, 12.5])(
    'renders nothing for %s — never a fabricated 0:00',
    (value) => {
      expect(formatDurationLabel(value as number)).toBeNull();
    },
  );

  it('formats an over-limit duration too — the Guest must SEE why it is blocked', () => {
    expect(formatDurationLabel(8917)).toBe('2:28:37');
  });
});
