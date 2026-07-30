// BUILD 20M — abuse/attack matrix for the pure playback-lease logic (Part 8 + the approved
// V2 amendments). Proves: Finish/Event-end/retry can't shorten or double-charge; billing is
// SUM(lease_seconds) union (overlap once); timed passes require the whole video inside the
// window; account-level union blocks a two-room bypass; unknown duration fails closed; FREE
// reset-boundary attribution is deterministic. The v2 RPC mirrors this logic; Postgres-level
// execution runs in the approved test-only cutover.

import { describe, it, expect } from 'vitest';
import {
  parseIso8601DurationSeconds,
  trustedLeaseDurationSeconds,
  computeLeaseExtension,
  authorizeStart,
  MIN_LEASE_SECONDS,
  MAX_LEASE_SECONDS,
  type Entitlement,
} from './playback-lease';

const S = 1000;
const free = (remainingSeconds: number): Entitlement => ({ kind: 'free', remainingSeconds });

describe('duration parse + trust bounds', () => {
  it('parses YouTube ISO-8601 durations', () => {
    expect(parseIso8601DurationSeconds('PT3M42S')).toBe(222);
    expect(parseIso8601DurationSeconds('PT1H2M')).toBe(3720);
    expect(parseIso8601DurationSeconds('PT45S')).toBe(45);
  });
  it('unparseable/zero → null', () => {
    for (const bad of ['', 'x', 'PT', 'PT0S', null, undefined]) expect(parseIso8601DurationSeconds(bad)).toBeNull();
  });
  it('trusts only [MIN, MAX]; multi-hour/short/non-finite → null (fail closed)', () => {
    expect(trustedLeaseDurationSeconds(222)).toBe(222);
    expect(trustedLeaseDurationSeconds(MIN_LEASE_SECONDS)).toBe(MIN_LEASE_SECONDS);
    expect(trustedLeaseDurationSeconds(MAX_LEASE_SECONDS)).toBe(MAX_LEASE_SECONDS);
    for (const bad of [10_800, MAX_LEASE_SECONDS + 1, 0, -5, null, Number.NaN]) {
      expect(trustedLeaseDurationSeconds(bad)).toBeNull();
    }
  });
});

describe('computeLeaseExtension — union (lease_seconds), non-shrink', () => {
  it('first start charges full D', () => {
    expect(computeLeaseExtension(null, 200, 0)).toEqual({ newLeaseEndsAtMs: 200 * S, chargeSeconds: 200 });
  });
  it('finish→next before lease end charges only the non-overlap (lease_seconds)', () => {
    expect(computeLeaseExtension(200 * S, 200, 50 * S)).toEqual({ newLeaseEndsAtMs: 250 * S, chargeSeconds: 50 });
  });
  it('fully-inside overlap charges 0 and never shrinks', () => {
    expect(computeLeaseExtension(300 * S, 50, 100 * S)).toEqual({ newLeaseEndsAtMs: 300 * S, chargeSeconds: 0 });
  });
  it('expired lease → full new interval', () => {
    expect(computeLeaseExtension(100 * S, 200, 150 * S)).toEqual({ newLeaseEndsAtMs: 350 * S, chargeSeconds: 200 });
  });
  it('SUM(lease_seconds) over A[0,200]+B[2,202] = 202 (NOT 400 from summing full intervals)', () => {
    const a = computeLeaseExtension(null, 200, 0);            // 200
    const b = computeLeaseExtension(a.newLeaseEndsAtMs, 200, 2 * S); // 2
    expect(a.chargeSeconds + b.chargeSeconds).toBe(202);
  });
  it('retry/replay against the already-advanced lease charges 0 (idempotent)', () => {
    const first = computeLeaseExtension(null, 200, 0);
    const replay = computeLeaseExtension(first.newLeaseEndsAtMs, 200, 0);
    expect(replay.chargeSeconds).toBe(0);
    expect(replay.newLeaseEndsAtMs).toBe(first.newLeaseEndsAtMs);
  });
});

describe('authorizeStart — FREE (fail-closed, boundary)', () => {
  const base = { currentLeaseEndsAtMs: null as number | null, nowMs: 0 };
  it('unknown duration BLOCKS (no lease, no handoff)', () => {
    expect(authorizeStart({ ...base, entitlement: free(900), durationSeconds: null })).toEqual({ authorized: false, reason: 'duration_unknown' });
  });
  it('sufficient FREE authorizes with the union charge', () => {
    const r = authorizeStart({ ...base, entitlement: free(900), durationSeconds: 200 });
    expect(r.authorized && r.charge.chargeSeconds).toBe(200);
  });
  it('exact boundary authorized (≤); one second short blocks', () => {
    expect(authorizeStart({ ...base, entitlement: free(200), durationSeconds: 200 }).authorized).toBe(true);
    expect(authorizeStart({ ...base, entitlement: free(199), durationSeconds: 200 })).toEqual({ authorized: false, reason: 'insufficient_free' });
  });
  it('rapid Start A → Finish → Start B cannot manufacture free playback', () => {
    const a = authorizeStart({ entitlement: free(900), durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(a.authorized && a.charge.chargeSeconds).toBe(200);
    const b = authorizeStart({ entitlement: free(700), durationSeconds: 200, currentLeaseEndsAtMs: 200 * S, nowMs: 2 * S });
    expect(b.authorized && b.charge.chargeSeconds).toBe(2); // union — [0,202] charged 202 total, not free
  });
});

describe('authorizeStart — timed pass full-video gate (amendment 3)', () => {
  it('ACTIVE pass with room for the whole video authorizes', () => {
    const r = authorizeStart({ entitlement: { kind: 'pass_active', expiresAtMs: 600 * S }, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r.authorized).toBe(true);
  });
  it('ACTIVE pass with 5s left BLOCKS a 10-min video (bypass closed)', () => {
    const r = authorizeStart({ entitlement: { kind: 'pass_active', expiresAtMs: 5 * S }, durationSeconds: 600, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r).toEqual({ authorized: false, reason: 'pass_insufficient' });
  });
  it('ACTIVE pass exact boundary (songEnd == expiry) authorized (≤)', () => {
    const r = authorizeStart({ entitlement: { kind: 'pass_active', expiresAtMs: 200 * S }, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r.authorized).toBe(true);
  });
  it('SELECTED pass first activation covers the full video and sets the window', () => {
    const r = authorizeStart({ entitlement: { kind: 'pass_selected', totalDurationSeconds: 3600 }, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r.authorized).toBe(true);
    if (r.authorized) expect(r.passActivationExpiresAtMs).toBe(3600 * S);
  });
  it('PRO is always authorized (unlimited)', () => {
    expect(authorizeStart({ entitlement: { kind: 'pro' }, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 }).authorized).toBe(true);
  });
});

describe('account-level union — two Rooms, one account (amendment 7 / concurrency)', () => {
  it('a second Room start sees the account lease end and charges only the extension', () => {
    // Room 1: FREE 900, D=200 @0 → lease→200s, charge 200.
    const r1 = authorizeStart({ entitlement: free(900), durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r1.authorized && r1.charge.newLeaseEndsAtMs).toBe(200 * S);
    // Room 2 (SAME account) starts @50s — the account-level currentLeaseEndsAtMs = 200s (not null),
    // so it charges only the union extension (50s), never a fresh 200s. Account lock + MAX(lease_ends_at)
    // in the RPC is what makes two rooms share one lease.
    const r2 = authorizeStart({ entitlement: free(700), durationSeconds: 200, currentLeaseEndsAtMs: 200 * S, nowMs: 50 * S });
    expect(r2.authorized && r2.charge.chargeSeconds).toBe(50);
  });
});

describe('FREE reset-boundary attribution (approved policy)', () => {
  // Absolute ms timeline; the SQL attributes lease_seconds to the window active at started_at
  // (04:00 America/Los_Angeles, DST-correct via date_trunc at tz). These prove the extension math.
  const t0359 = 0;            // "03:59" (1 min before reset)
  const reset = 60 * S;       // "04:00"
  it('03:59 · 5-min video · 5:00 left → allowed, whole lease attributed to the prior day', () => {
    const r = authorizeStart({ entitlement: free(300), durationSeconds: 300, currentLeaseEndsAtMs: null, nowMs: t0359 });
    expect(r.authorized && r.charge.chargeSeconds).toBe(300); // lease runs to 04:04; not refunded at 04:00
  });
  it('03:59 · 5-min video · 4:59 left → blocked', () => {
    expect(authorizeStart({ entitlement: free(299), durationSeconds: 300, currentLeaseEndsAtMs: null, nowMs: t0359 })).toEqual({ authorized: false, reason: 'insufficient_free' });
  });
  it('a later start beyond the crossing lease charges only the extension to the NEW window', () => {
    // prior lease ends 04:04 (= reset + 4min). Start a 5-min song at 04:01.
    const leaseEnd = reset + 4 * 60 * S;         // 04:04
    const now = reset + 1 * 60 * S;              // 04:01
    const r = computeLeaseExtension(leaseEnd, 300, now); // proposed end 04:06 → extension 2min
    expect(r.chargeSeconds).toBe(120);
    expect(r.newLeaseEndsAtMs).toBe(reset + 6 * 60 * S);
  });
});

describe('non-shrink invariant (Finish / Event-end / retry)', () => {
  it('no operation reduces a lease end below its authorized value', () => {
    const prior = 500 * S;
    for (const [dur, now] of [[10, 0], [1, 499], [200, 100], [50, 250]] as const) {
      expect(computeLeaseExtension(prior, dur, now * S).newLeaseEndsAtMs).toBeGreaterThanOrEqual(prior);
    }
  });
});
