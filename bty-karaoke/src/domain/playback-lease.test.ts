// BUILD 20M — abuse/attack matrix for the pure playback-lease union math (Part 8). These
// prove the invariants a persisted lease must uphold: Finish/Event-end/retry cannot shorten
// or double-charge, overlap is charged once, unknown duration fails closed. Persistence
// (the atomic RPC + unique key) enforces once-only application; here we prove the math it runs.

import { describe, it, expect } from 'vitest';
import {
  parseIso8601DurationSeconds,
  trustedLeaseDurationSeconds,
  computeLeaseExtension,
  authorizeStart,
  MIN_LEASE_SECONDS,
  MAX_LEASE_SECONDS,
} from './playback-lease';

const S = 1000; // ms per second

describe('parseIso8601DurationSeconds', () => {
  it('parses common YouTube durations', () => {
    expect(parseIso8601DurationSeconds('PT3M42S')).toBe(222);
    expect(parseIso8601DurationSeconds('PT1H2M')).toBe(3720);
    expect(parseIso8601DurationSeconds('PT45S')).toBe(45);
    expect(parseIso8601DurationSeconds('P1DT2H')).toBe(93600);
  });
  it('returns null for unparseable / empty / zero', () => {
    for (const bad of ['', 'garbage', 'PT', 'PT0S', null, undefined]) {
      expect(parseIso8601DurationSeconds(bad)).toBeNull();
    }
  });
});

describe('trustedLeaseDurationSeconds — extreme-duration validation', () => {
  it('accepts an in-range karaoke duration', () => {
    expect(trustedLeaseDurationSeconds(222)).toBe(222);
    expect(trustedLeaseDurationSeconds(MIN_LEASE_SECONDS)).toBe(MIN_LEASE_SECONDS);
    expect(trustedLeaseDurationSeconds(MAX_LEASE_SECONDS)).toBe(MAX_LEASE_SECONDS);
  });
  it('rejects a malformed multi-hour / too-short / non-finite value → null (fail closed)', () => {
    expect(trustedLeaseDurationSeconds(10_800)).toBeNull(); // 3h compilation
    expect(trustedLeaseDurationSeconds(MAX_LEASE_SECONDS + 1)).toBeNull();
    expect(trustedLeaseDurationSeconds(0)).toBeNull();
    expect(trustedLeaseDurationSeconds(-5)).toBeNull();
    expect(trustedLeaseDurationSeconds(null)).toBeNull();
    expect(trustedLeaseDurationSeconds(Number.NaN)).toBeNull();
  });
});

describe('computeLeaseExtension — union math (Part 4)', () => {
  it('A. first start (no lease) charges the full duration', () => {
    expect(computeLeaseExtension(null, 200, 0)).toEqual({ newLeaseEndsAtMs: 200 * S, chargeSeconds: 200 });
  });
  it('D. start after the prior lease expired charges the full new duration', () => {
    // prior lease ended at 100s; now = 150s
    expect(computeLeaseExtension(100 * S, 200, 150 * S)).toEqual({ newLeaseEndsAtMs: 350 * S, chargeSeconds: 200 });
  });
  it('C. finish→next before lease end charges only the non-overlapping extension', () => {
    // lease to 200s; start next (dur 200) at 50s → union end 250s, charge 50s
    expect(computeLeaseExtension(200 * S, 200, 50 * S)).toEqual({ newLeaseEndsAtMs: 250 * S, chargeSeconds: 50 });
  });
  it('overlap fully inside the active lease charges ZERO and never shrinks it', () => {
    // lease to 300s; a shorter next (dur 50) at 100s ends at 150s < 300s → charge 0, end stays 300s
    expect(computeLeaseExtension(300 * S, 50, 100 * S)).toEqual({ newLeaseEndsAtMs: 300 * S, chargeSeconds: 0 });
  });
  it('is deterministic — identical inputs yield identical output (retry-safe math)', () => {
    const a = computeLeaseExtension(200 * S, 200, 50 * S);
    const b = computeLeaseExtension(200 * S, 200, 50 * S);
    expect(a).toEqual(b);
  });
  it('re-applying against an already-advanced lease charges 0 (idempotent replay)', () => {
    const first = computeLeaseExtension(null, 200, 0); // end 200s, charge 200
    // a replay observes the lease already at 200s and the same now → charges nothing more
    const replay = computeLeaseExtension(first.newLeaseEndsAtMs, 200, 0);
    expect(replay.chargeSeconds).toBe(0);
    expect(replay.newLeaseEndsAtMs).toBe(first.newLeaseEndsAtMs);
  });
});

describe('authorizeStart — pre-handoff entitlement (Part 5), fail-closed', () => {
  const base = { currentLeaseEndsAtMs: null as number | null, nowMs: 0 };

  it('unknown duration BLOCKS (fail closed) — no lease, no handoff', () => {
    const r = authorizeStart({ ...base, unlimited: false, remainingSeconds: 900, durationSeconds: null });
    expect(r).toEqual({ authorized: false, reason: 'duration_unknown' });
  });

  it('sufficient FREE time authorizes with the union charge', () => {
    const r = authorizeStart({ ...base, unlimited: false, remainingSeconds: 900, durationSeconds: 200 });
    expect(r.authorized).toBe(true);
    if (r.authorized) expect(r.charge).toEqual({ newLeaseEndsAtMs: 200 * S, chargeSeconds: 200 });
  });

  it('exact boundary (charge == remaining) is authorized (≤)', () => {
    const r = authorizeStart({ ...base, unlimited: false, remainingSeconds: 200, durationSeconds: 200 });
    expect(r.authorized).toBe(true);
  });

  it('insufficient FREE time BLOCKS before YouTube opens', () => {
    const r = authorizeStart({ ...base, unlimited: false, remainingSeconds: 199, durationSeconds: 200 });
    expect(r).toEqual({ authorized: false, reason: 'insufficient' });
  });

  it('rapid Start A → Finish → Start B cannot manufacture free playback', () => {
    // FREE = 900s. A: dur 200 @ 0 → charge 200, lease→200s.
    const a = authorizeStart({ unlimited: false, remainingSeconds: 900, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(a.authorized && a.charge.chargeSeconds).toBe(200);
    // Host taps Finish at 2s (lease still to 200s). B: dur 200 @ 2s → charge only 2s (union), not 200.
    const b = authorizeStart({ unlimited: false, remainingSeconds: 700, durationSeconds: 200, currentLeaseEndsAtMs: 200 * S, nowMs: 2 * S });
    expect(b.authorized && b.charge.chargeSeconds).toBe(2);
    // Total charged for the authorized window [0, 202s] = 202s — the FREE window is not reusable.
  });

  it('PRO / active timed pass is always authorized and never gated by FREE remaining', () => {
    const r = authorizeStart({ unlimited: true, remainingSeconds: 0, durationSeconds: 200, currentLeaseEndsAtMs: null, nowMs: 0 });
    expect(r.authorized).toBe(true);
  });

  it('expired lease → a fresh full interval is authorized (charges full D)', () => {
    const r = authorizeStart({ unlimited: false, remainingSeconds: 900, durationSeconds: 200, currentLeaseEndsAtMs: 100 * S, nowMs: 150 * S });
    expect(r.authorized && r.charge.chargeSeconds).toBe(200);
  });
});

describe('lease non-shrink invariants (Finish / Event-end / retry)', () => {
  it('there is NO operation in this module that reduces a lease end below its authorized value', () => {
    // Every extension result is max(activeEnd, proposedEnd) ≥ the prior active end.
    const prior = 500 * S;
    for (const [dur, now] of [[10, 0], [1, 499], [200, 100], [0.001 as number, 250]] as const) {
      const ext = computeLeaseExtension(prior, Math.max(1, Math.floor(dur)), now * S);
      expect(ext.newLeaseEndsAtMs).toBeGreaterThanOrEqual(prior);
    }
  });
});
