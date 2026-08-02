// @vitest-environment jsdom
//
// B2 — the web Admin FREE-minutes banner renders the server-truth projection and only
// that. Warnings are calm (status role, not error/red); the true block is an alert.
// PRO and enforcement-disabled render nothing. Because it renders straight from the
// projection prop (never from a local countdown), the correct state is reconstructed
// after any refresh/relaunch — that is what "survives refresh" means here.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import UsageBanner from './UsageBanner';
import { projectUsage, type UsageEntitlement } from '@/domain/usage';

function ent(remaining: number, opts: { playing?: boolean; enforcement?: boolean; plan?: 'FREE' | 'PRO' } = {}): UsageEntitlement {
  return {
    plan: opts.plan ?? 'FREE',
    unlimited: opts.plan === 'PRO',
    enforcementEnabled: opts.enforcement ?? true,
    limitSeconds: 900,
    usedSeconds: 900 - Math.max(0, remaining),
    remainingSeconds: opts.plan === 'PRO' ? null : remaining,
    activePlaybackCount: opts.playing ? 1 : 0,
    nextResetAt: '2026-07-24T11:00:00.000Z',
    windowStart: '2026-07-23T11:00:00.000Z',
    timezone: 'America/Los_Angeles',
    warnLevel: 'none',
  };
}

afterEach(() => cleanup());

describe('UsageBanner', () => {
  it('normal → shows remaining, status role (calm, not alert)', () => {
    render(<UsageBanner usage={projectUsage(ent(720))} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('data-banner-kind')).toBe('normal');
    expect(el.textContent).toMatch(/12:00/); // 720s = 12:00 remaining
  });

  it('five_min → calm status banner', () => {
    render(<UsageBanner usage={projectUsage(ent(200))} />);
    expect(screen.getByRole('status').getAttribute('data-banner-kind')).toBe('five_min');
  });

  it('two_min → calm status banner', () => {
    render(<UsageBanner usage={projectUsage(ent(90))} />);
    expect(screen.getByRole('status').getAttribute('data-banner-kind')).toBe('two_min');
  });

  it('zero while playing → status (this song may finish), not an alert', () => {
    render(<UsageBanner usage={projectUsage(ent(0, { playing: true }))} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('data-banner-kind')).toBe('zero_playing');
    expect(el.textContent).toMatch(/다음 곡은 시작할 수 없어요/);
  });

  it('zero idle → alert (genuine block), upgrade copy', () => {
    render(<UsageBanner usage={projectUsage(ent(0, { playing: false }))} />);
    const el = screen.getByRole('alert');
    expect(el.getAttribute('data-banner-kind')).toBe('zero_idle');
    expect(el.textContent).toMatch(/PRO/);
  });

  it('PRO → renders nothing (no FREE countdown)', () => {
    const { container } = render(<UsageBanner usage={projectUsage(ent(0, { plan: 'PRO' }))} />);
    expect(container.firstChild).toBeNull();
  });

  it('enforcement disabled → renders nothing (no active-enforcement warning)', () => {
    const { container } = render(<UsageBanner usage={projectUsage(ent(0, { enforcement: false }))} />);
    expect(container.firstChild).toBeNull();
  });

  it('null usage → renders nothing', () => {
    const { container } = render(<UsageBanner usage={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── BUILD 24 regressions ───────────────────────────────────────────────────────
//
// These pin the two v2-entitlement fields BUILD 20M silently dropped. The tests above already
// PASSED while the product was broken, because they build the entitlement by hand — the live
// RPC simply never supplied `activePlaybackCount` or `nextResetAt`, so `projectUsage` saw 0/null
// and the banner degraded. The cases below assert what happens when the server omits them, so a
// future entitlement rewrite that drops a field again fails here instead of in production.
describe('BUILD 24 — server-field regressions', () => {
  /** An entitlement shaped like the BUILD 20M v2 RPC: no activePlaybackCount, no nextResetAt. */
  const v20mShaped = (remaining: number): UsageEntitlement => ({
    ...ent(remaining, { playing: true }),
    activePlaybackCount: 0, // the field the v2 RPC never sent → parseEntitlement defaults it
    nextResetAt: null, //     likewise
  });

  it('D1: without activePlaybackCount an exhausted-mid-song Host is wrongly shown the red block', () => {
    // This is the defect, asserted as the OLD behaviour so its absence is meaningful below.
    render(<UsageBanner usage={projectUsage(v20mShaped(0))} />);
    expect(screen.getByRole('alert').getAttribute('data-banner-kind')).toBe('zero_idle');
  });

  it('D1: with activePlaybackCount restored the same Host is told this song may finish', () => {
    render(<UsageBanner usage={projectUsage(ent(0, { playing: true }))} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('data-banner-kind')).toBe('zero_playing');
    expect(el.textContent).toMatch(/이 곡은 끝까지 부를 수 있지만/);
    // It must NOT be the alert role — nothing is blocked about the song already on stage.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('D2: without nextResetAt the reset line silently vanishes', () => {
    render(<UsageBanner usage={projectUsage(v20mShaped(720))} />);
    expect(screen.getByRole('status').textContent).not.toMatch(/초기화/);
  });

  it('D2: with nextResetAt restored the Host is told when FREE comes back', () => {
    render(<UsageBanner usage={projectUsage(ent(720))} />);
    expect(screen.getByRole('status').textContent).toMatch(/초기화돼요/);
  });

  it('D2: the exhausted block also names the reset time', () => {
    render(<UsageBanner usage={projectUsage(ent(0, { playing: false }))} />);
    expect(screen.getByRole('alert').textContent).toMatch(/초기화돼요/);
  });
});

// ── BUILD 24 §6.5 / §8 — one number, one granularity, every state ──────────────
describe('BUILD 24 — the remaining time is exact and always visible', () => {
  it('shows MM:SS in EVERY FREE + enforced state (native parity)', () => {
    for (const [remaining, expected] of [[720, '12:00'], [200, '3:20'], [90, '1:30']] as const) {
      const { unmount } = render(<UsageBanner usage={projectUsage(ent(remaining))} />);
      expect(screen.getByRole('status').textContent).toContain(expected);
      unmount();
    }
  });

  it('never rounds to whole minutes — the "13분 for ages" granularity is gone', () => {
    // 780s and 838s both render "13분" at minute granularity; they must differ here.
    const a = render(<UsageBanner usage={projectUsage(ent(780))} />);
    const first = screen.getByRole('status').textContent!;
    a.unmount();
    render(<UsageBanner usage={projectUsage(ent(838))} />);
    const second = screen.getByRole('status').textContent!;
    expect(first).toContain('13:00');
    expect(second).toContain('13:58');
    expect(first).not.toBe(second);
  });

  it('the number is the server balance verbatim — no client projection, no double-charge', () => {
    // 900 - 162 (a 2:42 song already debited at admission) = 738 = 12:18. The banner must show
    // exactly that and must NOT subtract elapsed playback a second time.
    render(<UsageBanner usage={projectUsage(ent(738, { playing: true }))} />);
    expect(screen.getByRole('status').textContent).toContain('12:18');
  });

  it('a negative server value can never reach the screen', () => {
    render(<UsageBanner usage={projectUsage(ent(-45))} />);
    expect(screen.getByRole('alert').textContent).not.toMatch(/-\d/);
  });
});
