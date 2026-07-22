// @vitest-environment jsdom
//
// PRO Multi-Room V1 — the Host Hub chooser, proved by rendering the real async server
// component against mocked canonical reads. Locks the required UI behavior:
//   0 rooms          → first-room onboarding (unchanged)
//   1 room + FREE    → auto-enter (redirect; no chooser)
//   1 room + PRO     → chooser WITH "노래방 추가 만들기"
//   3 rooms + PRO    → chooser WITH "3 of 3 Norebangs used", NO create action
//   2 rooms + FREE   → chooser (legacy), "FREE includes 1 Norebang", NO create action

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {
  token: 'host-token' as string | null,
  account: { id: 'acct-1', displayName: 'Chi', email: 'x@y.z' } as null | { id: string; displayName: string; email: string },
  rooms: [] as Array<{ slug: string; displayName: string; hasActiveEvent: boolean; queueCount: number; activeEvent: null }>,
  plan: 'FREE' as 'FREE' | 'PRO',
};

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (state.token ? { value: state.token } : undefined) }) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('REDIRECT'), { url });
  },
}));
vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: async () => state.account,
  listHostRooms: async () => state.rooms,
  publicAccount: (a: { displayName: string; email: string }) => ({ displayName: a.displayName, email: a.email }),
}));
vi.mock('@/lib/host-plan.server', () => ({
  resolveNorebangHostEntitlements: async () => ({ planCode: state.plan }),
}));
vi.mock('@/lib/host-csrf.server', () => ({ csrfTokenOrNull: async () => 'csrf', CSRF_FIELD_NAME: 'csrf' }));
vi.mock('@/lib/google-oauth.server', () => ({ googleWebConfigured: () => true }));
vi.mock('@/lib/host-web-session.server', () => ({ HOST_COOKIE: 'bty_host' }));
vi.mock('@/components/legal/LegalLinks', () => ({ default: () => null }));

import HostEntryScreen from './HostEntryScreen';

function room(slug: string) {
  return { slug, displayName: slug, hasActiveEvent: false, queueCount: 0, activeEvent: null };
}

async function renderHub() {
  const el = await HostEntryScreen({ notice: undefined });
  render(el);
}

beforeEach(() => {
  cleanup();
  state.token = 'host-token';
  state.account = { id: 'acct-1', displayName: 'Chi', email: 'x@y.z' };
  state.rooms = [];
  state.plan = 'FREE';
});

describe('HostEntryScreen — PRO Multi-Room chooser', () => {
  it('0 rooms → first-room onboarding (unchanged), no add/limit copy', async () => {
    state.rooms = [];
    await renderHub();
    expect(screen.getByText('노래방을 만드세요')).toBeTruthy();
    expect(screen.queryByText(/추가 만들기/)).toBeNull();
  });

  it('1 room + FREE → auto-enter (redirect to the admin bridge), no chooser render', async () => {
    state.plan = 'FREE';
    state.rooms = [room('bty-home')];
    let redirectedTo = '';
    try {
      await renderHub();
    } catch (e) {
      redirectedTo = (e as { url?: string }).url ?? '';
    }
    expect(redirectedTo).toBe('/host/rooms/bty-home/enter');
  });

  it('1 room + PRO → chooser WITH "노래방 추가 만들기"', async () => {
    state.plan = 'PRO';
    state.rooms = [room('bty-home')];
    await renderHub();
    // Rendered in both the card heading and the submit button.
    expect(screen.getAllByText(/노래방 추가 만들기/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/of 3 Norebangs used/)).toBeNull();
    expect(screen.getByText('PRO')).toBeTruthy(); // plan chip shown
  });

  it('3 rooms + PRO → chooser WITH "3 of 3", NO create action', async () => {
    state.plan = 'PRO';
    state.rooms = [room('a'), room('b'), room('c')];
    await renderHub();
    expect(screen.getByText(/3 of 3 Norebangs used/)).toBeTruthy();
    expect(screen.queryByText(/추가 만들기/)).toBeNull();
  });

  it('2 rooms + FREE (legacy) → chooser, "FREE includes 1 Norebang", NO create action, access intact', async () => {
    state.plan = 'FREE';
    state.rooms = [room('a'), room('b')];
    await renderHub();
    expect(screen.getByText(/FREE includes 1 Norebang/)).toBeTruthy();
    expect(screen.queryByText(/추가 만들기/)).toBeNull();
    // both legacy Rooms still rendered (access preserved)
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});
