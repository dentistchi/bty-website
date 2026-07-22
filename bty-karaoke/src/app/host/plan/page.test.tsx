// @vitest-environment jsdom
//
// Host Plan screen READ authorization + honest rendering (Host Plan V1), proved by
// rendering the real server component:
//   - signed out            → redirect to the root login (no plan data leaks)
//   - authenticated Host     → Free / Active + feature list; Pro shown as "준비 중"
//   - NO purchase/upgrade/checkout CTA exists anywhere on the page
// Rendering performs pure reads (no Event, no provisioning).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {
  token: 'host-token' as string | null,
  entitlements: {
    planCode: 'FREE',
    planStatus: 'ACTIVE',
    source: 'SYSTEM_DEFAULT',
    capabilities: {
      canCreateRoom: true,
      canEditRoomSettings: true,
      canUsePresetBranding: true,
      canStartEvent: true,
      canManageQueue: true,
      canUseGuestQR: true,
    },
    fallback: false,
  },
};

vi.mock('next/navigation', () => ({
  redirect: (p: string) => {
    throw new Error(`REDIRECT:${p}`);
  },
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (state.token ? { value: state.token } : undefined) }),
}));
vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async () => (state.token ? { id: 'acct-1' } : null)),
}));
vi.mock('@/lib/host-web-session.server', () => ({ HOST_COOKIE: 'bty_host' }));
vi.mock('@/lib/host-plan.server', () => ({
  resolveNorebangHostEntitlements: vi.fn(async () => state.entitlements),
}));
vi.mock('@/components/legal/LegalLinks', () => ({ default: () => <div /> }));

import HostPlanPage from './page';

async function renderPage() {
  render(await HostPlanPage());
}

beforeEach(() => {
  cleanup();
  state.token = 'host-token';
  state.entitlements = {
    planCode: 'FREE',
    planStatus: 'ACTIVE',
    source: 'SYSTEM_DEFAULT',
    capabilities: {
      canCreateRoom: true,
      canEditRoomSettings: true,
      canUsePresetBranding: true,
      canStartEvent: true,
      canManageQueue: true,
      canUseGuestQR: true,
    },
    fallback: false,
  };
});

describe('GET /host/plan', () => {
  it('(15/16) authenticated Host → Free is shown as the active plan', async () => {
    await renderPage();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText(/Active/)).toBeTruthy();
  });

  it('(17) Pro is shown as 준비 중 / Coming later — never as purchasable', async () => {
    await renderPage();
    expect(screen.getByText('Pro')).toBeTruthy();
    // "준비 중" appears in both the badge and the honest disclaimer — at least once.
    expect(screen.getAllByText(/준비 중|Coming later/).length).toBeGreaterThan(0);
  });

  it('(18) there is NO purchase/upgrade/checkout CTA on the page', async () => {
    const { container } = render(await HostPlanPage());
    // No actionable purchase controls: no buttons, no upgrade/checkout/pay links,
    // and no price glyphs. (Honest copy MAY say "구매/결제 없음" — that is not a CTA.)
    expect(container.querySelectorAll('button').length).toBe(0);
    const actionable = [...container.querySelectorAll('a')].map(
      (a) => `${a.textContent ?? ''} ${a.getAttribute('href') ?? ''}`,
    );
    expect(actionable.some((s) => /upgrade|checkout|buy|pay|구매하기|결제하기|업그레이드/i.test(s))).toBe(false);
    expect(screen.queryByText(/\$\d|₩\d|무료 체험|free trial/i)).toBeNull();
  });

  it('shows the current Host features included with Free', async () => {
    await renderPage();
    expect(screen.getByText('Room 설정')).toBeTruthy();
    expect(screen.getByText('Guest QR 및 신청')).toBeTruthy();
  });

  it('(19) signed out → redirect to root; no plan data rendered', async () => {
    state.token = null;
    await expect(renderPage()).rejects.toThrow('REDIRECT:/');
  });

  it('an anomalous FREE fallback still renders Free/Active (never a paid plan)', async () => {
    state.entitlements = { ...state.entitlements, fallback: true };
    await renderPage();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.queryByText('Pro — 사용 중')).toBeNull();
  });

  it('(24) a PRO pilot account shows Pro · Active · Pilot with an honest no-billing note', async () => {
    state.entitlements = { ...state.entitlements, planCode: 'PRO', source: 'MANUAL' };
    await renderPage();
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText(/Active · Pilot/)).toBeTruthy();
    // Honest: internal pilot, no billing connected, no extra feature/limit yet.
    expect(screen.getByText(/내부 파일럿/)).toBeTruthy();
    expect(screen.getByText(/결제는 아직 연결되어 있지 않/)).toBeTruthy();
    // Free is shown as the base/previous plan.
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('(25) even in PRO pilot there is NO price or purchase CTA', async () => {
    state.entitlements = { ...state.entitlements, planCode: 'PRO', source: 'MANUAL' };
    const { container } = render(await HostPlanPage());
    expect(container.querySelectorAll('button').length).toBe(0);
    const actionable = [...container.querySelectorAll('a')].map(
      (a) => `${a.textContent ?? ''} ${a.getAttribute('href') ?? ''}`,
    );
    expect(actionable.some((s) => /upgrade|checkout|buy|pay|구매하기|결제하기|업그레이드/i.test(s))).toBe(false);
    expect(screen.queryByText(/\$\d|₩\d|무료 체험|free trial/i)).toBeNull();
  });
});
