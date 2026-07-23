// B2 — pure usage PROJECTION matrix. Deterministic; no I/O. Pins the client-facing
// banner decision (§10/§11) and the start-block flag both clients render from.

import { describe, it, expect } from 'vitest';
import { projectUsage, parseEntitlement, projectEntitlement, type UsageEntitlement } from './usage';

/** A FREE entitlement snapshot with enforcement ON; override remaining/playing per case. */
function free(remaining: number, opts: { playing?: boolean; enforcement?: boolean } = {}): UsageEntitlement {
  const warn = !opts.enforcement && opts.enforcement !== undefined
    ? 'none'
    : remaining <= 0
      ? 'zero'
      : remaining <= 120
        ? 'two_min'
        : remaining <= 300
          ? 'five_min'
          : 'none';
  return {
    plan: 'FREE',
    unlimited: false,
    enforcementEnabled: opts.enforcement ?? true,
    limitSeconds: 900,
    usedSeconds: 900 - Math.max(0, remaining),
    remainingSeconds: remaining,
    activePlaybackCount: opts.playing ? 1 : 0,
    nextResetAt: '2026-07-24T11:00:00.000Z',
    windowStart: '2026-07-23T11:00:00.000Z',
    timezone: 'America/Los_Angeles',
    warnLevel: (opts.enforcement === false ? 'none' : warn) as UsageEntitlement['warnLevel'],
  };
}

describe('projectUsage — banner thresholds (§10)', () => {
  it('remaining 900 → normal, not blocked', () => {
    const p = projectUsage(free(900));
    expect(p.bannerKind).toBe('normal');
    expect(p.startBlocked).toBe(false);
  });
  it('remaining 301 → normal (no warning)', () => {
    expect(projectUsage(free(301)).bannerKind).toBe('normal');
  });
  it('remaining 300 → five_min', () => {
    expect(projectUsage(free(300)).bannerKind).toBe('five_min');
  });
  it('remaining 121 → five_min', () => {
    expect(projectUsage(free(121)).bannerKind).toBe('five_min');
  });
  it('remaining 120 → two_min', () => {
    expect(projectUsage(free(120)).bannerKind).toBe('two_min');
  });
  it('remaining 1 → two_min, not blocked (a song may still start)', () => {
    const p = projectUsage(free(1));
    expect(p.bannerKind).toBe('two_min');
    expect(p.startBlocked).toBe(false);
  });
  it('remaining 0 while playing → zero_playing, blocked', () => {
    const p = projectUsage(free(0, { playing: true }));
    expect(p.bannerKind).toBe('zero_playing');
    expect(p.startBlocked).toBe(true);
  });
  it('remaining 0 while idle → zero_idle, blocked', () => {
    const p = projectUsage(free(0, { playing: false }));
    expect(p.bannerKind).toBe('zero_idle');
    expect(p.startBlocked).toBe(true);
  });
  it('five_min and two_min are mutually exclusive (never both)', () => {
    expect(projectUsage(free(200)).bannerKind).toBe('five_min');
    expect(projectUsage(free(90)).bannerKind).toBe('two_min');
  });
});

describe('projectUsage — display safety (§6)', () => {
  it('never shows a negative remaining (clamped to 0)', () => {
    const e = free(-45, { playing: true }); // internal overage
    const p = projectUsage(e);
    expect(p.remainingSeconds).toBe(0);
    expect(p.bannerKind).toBe('zero_playing');
  });
});

describe('projectUsage — PRO (§3/§11)', () => {
  it('PRO → pro banner, never blocked, no remaining', () => {
    const e: UsageEntitlement = {
      plan: 'PRO', unlimited: true, enforcementEnabled: true, limitSeconds: null,
      usedSeconds: 0, remainingSeconds: null, activePlaybackCount: 1,
      nextResetAt: null, windowStart: null, timezone: 'America/Los_Angeles', warnLevel: 'none',
    };
    const p = projectUsage(e);
    expect(p.bannerKind).toBe('pro');
    expect(p.startBlocked).toBe(false);
    expect(p.remainingSeconds).toBeNull();
  });
});

describe('projectUsage — enforcement disabled (§9/§11)', () => {
  it('FREE + enforcement off → disabled banner, never blocked, even at 0', () => {
    const p = projectUsage(free(0, { playing: false, enforcement: false }));
    expect(p.bannerKind).toBe('disabled');
    expect(p.startBlocked).toBe(false);
  });
  it('FREE + enforcement off at healthy remaining → disabled (no active-enforcement warning)', () => {
    expect(projectUsage(free(600, { enforcement: false })).bannerKind).toBe('disabled');
  });
});

describe('parseEntitlement — raw RPC coercion', () => {
  it('parses a well-formed FREE snapshot', () => {
    const raw = { plan: 'FREE', unlimited: false, enforcementEnabled: true, limitSeconds: 900, usedSeconds: 30, remainingSeconds: 870, activePlaybackCount: 0, nextResetAt: 'x', windowStart: 'y', timezone: 'UTC', warnLevel: 'none' };
    expect(parseEntitlement(raw)?.remainingSeconds).toBe(870);
  });
  it('unknown warnLevel collapses to none; missing plan defaults FREE', () => {
    const p = parseEntitlement({ warnLevel: 'weird' });
    expect(p?.plan).toBe('FREE');
    expect(p?.warnLevel).toBe('none');
  });
  it('non-object → null (fail safe)', () => {
    expect(parseEntitlement(null)).toBeNull();
    expect(parseEntitlement('nope')).toBeNull();
  });
  it('projectEntitlement chains parse+project, null on garbage', () => {
    expect(projectEntitlement(undefined)).toBeNull();
    expect(projectEntitlement({ plan: 'FREE', enforcementEnabled: true, remainingSeconds: 0, activePlaybackCount: 0 })?.bannerKind).toBe('zero_idle');
  });
});
