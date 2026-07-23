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
