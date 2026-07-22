// @vitest-environment jsdom
//
// Room-limit policy correction — the Host Hub, proved by rendering the real async server
// component against mocked canonical reads. Locks the required behavior:
//   0 rooms                    → first-room onboarding (unchanged)
//   1 room, normal entry        → auto-enter (redirect; no chooser)
//   1 room, explicit hub        → chooser WITH "노래방 추가 만들기" (any plan)
//   2 rooms                     → chooser WITH "노래방 추가 만들기", NO limit copy
//   the create form carries a server-issued hidden idempotencyKey

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
async function renderHub(view?: string) {
  const el = await HostEntryScreen({ notice: undefined, view });
  render(el);
}

beforeEach(() => {
  cleanup();
  state.token = 'host-token';
  state.account = { id: 'acct-1', displayName: 'Chi', email: 'x@y.z' };
  state.rooms = [];
  state.plan = 'FREE';
});

describe('HostEntryScreen — Room-limit policy correction', () => {
  it('0 rooms → first-room onboarding, no add copy', async () => {
    state.rooms = [];
    await renderHub();
    expect(screen.getByText('노래방을 만드세요')).toBeTruthy();
  });

  it('1 room, normal entry → auto-enter (redirect), no chooser', async () => {
    state.rooms = [room('bty-home')];
    let to = '';
    try {
      await renderHub();
    } catch (e) {
      to = (e as { url?: string }).url ?? '';
    }
    expect(to).toBe('/host/rooms/bty-home/enter');
  });

  it('1 room, explicit hub (view=rooms) → chooser WITH "노래방 추가 만들기" and a hidden idempotencyKey', async () => {
    state.rooms = [room('bty-home')];
    await renderHub('rooms');
    expect(screen.getAllByText(/노래방 추가 만들기/).length).toBeGreaterThan(0);
    const hidden = document.querySelector('input[name="idempotencyKey"]') as HTMLInputElement | null;
    expect(hidden?.value).toBeTruthy();
  });

  it('2 rooms → chooser WITH "노래방 추가 만들기", NO limit copy', async () => {
    state.plan = 'FREE';
    state.rooms = [room('a'), room('b')];
    await renderHub();
    expect(screen.getAllByText(/노래방 추가 만들기/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/of 3 Norebangs used/)).toBeNull();
    expect(screen.queryByText(/FREE includes 1 Norebang/)).toBeNull();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});
