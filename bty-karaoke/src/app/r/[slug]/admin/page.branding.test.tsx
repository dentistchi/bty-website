// @vitest-environment jsdom
//
// Room Branding V1 — the Admin identity surface reflects the Room's theme + logo.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const state = {
  room: {
    id: 'room-chi',
    slug: 'chi-norebang-xqjbyszq',
    display_name: 'Chi Family Norebang',
    status: 'open',
    guest_welcome_message: null as string | null,
    logo_object_key: null as string | null,
    logo_version: null as string | null,
    branding_theme: 'midnight_gold',
  },
};

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/lib/host-csrf.server', () => ({ csrfTokenOrNull: async () => null, CSRF_FIELD_NAME: 'csrf' }));
vi.mock('@/lib/host-web-session.server', () => ({ HOST_COOKIE: 'bty_host' }));
vi.mock('./AdminConsole', () => ({ default: () => <div data-testid="admin-console" /> }));

import AdminPage from './page';

async function renderAdmin() {
  return render(await AdminPage({ params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }) }));
}

beforeEach(() => {
  cleanup();
  state.room = {
    id: 'room-chi', slug: 'chi-norebang-xqjbyszq', display_name: 'Chi Family Norebang', status: 'open',
    guest_welcome_message: null, logo_object_key: null, logo_version: null, branding_theme: 'midnight_gold',
  };
});

describe('Admin surface branding', () => {
  it('applies the theme via data-theme on the Admin main', async () => {
    state.room.branding_theme = 'warm_stage';
    const { container } = await renderAdmin();
    expect(container.querySelector('main')?.getAttribute('data-theme')).toBe('warm_stage');
  });

  it('renders the logo (public proxy, versioned) when present, none otherwise', async () => {
    state.room.logo_object_key = 'rooms/room-chi/logo-X.webp';
    state.room.logo_version = 'ver123';
    const { container } = await renderAdmin();
    const img = container.querySelector('img.room-logo') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('/api/public/rooms/chi-norebang-xqjbyszq/logo?v=ver123');
  });

  it('renders no logo image when the Room has none', async () => {
    const { container } = await renderAdmin();
    expect(container.querySelector('img.room-logo')).toBeNull();
    expect(container.querySelector('[data-testid="admin-console"]')).toBeTruthy();
  });
});
