// @vitest-environment jsdom
//
// Room Settings V1 — the Settings page READ authorization, proved by rendering the
// real server component. Identity-first, owner-only, and no room-existence oracle:
//   - signed out            → redirect to the root login
//   - authenticated owner    → the pre-filled editor renders (no slug/passcode field)
//   - authenticated non-owner → the SAME redirect to root as an unknown Room
//   - unknown Room           → redirect to root
// Rendering performs pure reads (no Event is created).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = {
  token: 'host-token' as string | null,
  account: { id: 'acct-1' } as null | { id: string },
  room: { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', display_name: 'Chi Norebang', status: 'open', guest_welcome_message: '기존' , logo_object_key: null, logo_version: null, branding_theme: 'midnight_gold' } as
    | null
    | { id: string; slug: string; display_name: string; status: string; guest_welcome_message: string | null; logo_object_key: string | null; logo_version: string | null; branding_theme: string },
  hasAccess: true,
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
  authorizeHost: vi.fn(async () => state.account),
  accountHasRoomAccess: vi.fn(async () => state.hasAccess),
}));
vi.mock('@/lib/host-csrf.server', () => ({ csrfTokenOrNull: async () => 'csrf-token', CSRF_FIELD_NAME: 'csrf' }));
vi.mock('@/lib/host-web-session.server', () => ({ HOST_COOKIE: 'bty_host' }));
vi.mock('@/lib/rooms.server', () => ({ getPublicRoomBySlug: vi.fn(async () => state.room) }));
vi.mock('@/components/legal/LegalLinks', () => ({ default: () => <div /> }));
// Stub the client form so this test isolates the page's authorization + prefill.
vi.mock('./RoomSettingsForm', () => ({
  default: ({ initialName, initialWelcome }: { initialName: string; initialWelcome: string }) => (
    <div data-testid="settings-form" data-name={initialName} data-welcome={initialWelcome} />
  ),
}));

import RoomSettingsPage from './page';

async function renderPage() {
  render(await RoomSettingsPage({
    params: Promise.resolve({ slug: 'chi-norebang-xqjbyszq' }),
    searchParams: Promise.resolve({}),
  }));
}

beforeEach(() => {
  cleanup();
  state.token = 'host-token';
  state.account = { id: 'acct-1' };
  state.room = { id: 'room-chi', slug: 'chi-norebang-xqjbyszq', display_name: 'Chi Norebang', status: 'open', guest_welcome_message: '기존' , logo_object_key: null, logo_version: null, branding_theme: 'midnight_gold' };
  state.hasAccess = true;
});

describe('GET /host/rooms/[slug]/settings (read authorization)', () => {
  it('authenticated owner → renders the editor pre-filled with current values', async () => {
    await renderPage();
    const form = screen.getByTestId('settings-form');
    expect(form.getAttribute('data-name')).toBe('Chi Norebang');
    expect(form.getAttribute('data-welcome')).toBe('기존');
    // No slug / Manager-passcode inputs on this screen.
    expect(screen.queryByText(/passcode|비밀번호|slug/i)).toBeNull();
  });

  it('signed out → redirect to the root login', async () => {
    state.account = null;
    await expect(renderPage()).rejects.toThrow('REDIRECT:/');
  });

  it('authenticated NON-owner → the SAME redirect to root (no oracle)', async () => {
    state.hasAccess = false;
    await expect(renderPage()).rejects.toThrow('REDIRECT:/');
  });

  it('unknown Room → redirect to root', async () => {
    state.room = null;
    await expect(renderPage()).rejects.toThrow('REDIRECT:/');
  });
});
