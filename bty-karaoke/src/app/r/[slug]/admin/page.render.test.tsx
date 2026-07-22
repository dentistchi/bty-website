// @vitest-environment jsdom
//
// Room Admin — the "My Norebang · 내 노래방 관리" hub link, proved by rendering the real
// async Admin page against mocked reads. It must appear ONLY for an authenticated Host
// session and point at the EXPLICIT hub (/?view=rooms) — which never auto-enters, so a
// single-Room Host reaches the chooser to add another Room. No Manager passcode involved.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = { hostToken: 'host-token' as string | null };

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (state.hostToken ? { value: state.hostToken } : undefined) }) }));
vi.mock('@/lib/rooms.server', () => ({
  getPublicRoomBySlug: async (slug: string) => ({
    slug,
    display_name: 'Chi Family Norebang',
    branding_theme: 'warm_stage',
    logo_object_key: null,
    logo_version: null,
  }),
}));
vi.mock('@/lib/host-csrf.server', () => ({ csrfTokenOrNull: async () => 'csrf', CSRF_FIELD_NAME: 'csrf' }));
vi.mock('@/domain/branding', () => ({ normalizeTheme: (t: string) => t }));
vi.mock('@/lib/host-web-session.server', () => ({ HOST_COOKIE: 'bty_host' }));
vi.mock('./AdminConsole', () => ({ default: () => null }));

import AdminPage from './page';

async function renderAdmin() {
  const el = await AdminPage({ params: Promise.resolve({ slug: 'chi-norebang' }) });
  render(el);
}

beforeEach(() => {
  cleanup();
  state.hostToken = 'host-token';
});

describe('Room Admin — My Norebang hub link', () => {
  it('shows "내 노래방 관리" pointing at the explicit hub (/?view=rooms) for a Host session', async () => {
    await renderAdmin();
    const link = screen.getByText('내 노래방 관리').closest('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/?view=rooms');
  });

  it('does NOT show the hub link when there is no Host session (DJ/manager-paired admin)', async () => {
    state.hostToken = null;
    await renderAdmin();
    expect(screen.queryByText('내 노래방 관리')).toBeNull();
  });
});
