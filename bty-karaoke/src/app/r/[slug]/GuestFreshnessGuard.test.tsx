// @vitest-environment jsdom
//
// BUILD 20B-WEB7-R4 — the guest freshness guard: it renders a non-visual served-
// build proof and, on a bfcache restore with a NEWER server build, reloads once.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import GuestFreshnessGuard from './GuestFreshnessGuard';
import { FRESHNESS_RELOAD_KEY } from '@/domain/build-freshness';

const reload = vi.fn();

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_KARAOKE_BUILD', 'runningAAAA');
  window.sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function firePageShowPersisted() {
  const e = new Event('pageshow') as PageTransitionEvent;
  Object.defineProperty(e, 'persisted', { value: true });
  window.dispatchEvent(e);
}

describe('GuestFreshnessGuard', () => {
  it('renders a non-visual served-build proof attribute', () => {
    const { container } = render(<GuestFreshnessGuard />);
    const el = container.querySelector('[data-karaoke-build]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.getAttribute('data-karaoke-build')).toBe('runningAAAA');
    expect(el.hasAttribute('hidden')).toBe(true); // never visible in the UI
  });

  it('reloads once on a bfcache restore when the server reports a newer build', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ build: 'servedBBBB' }) })) as unknown as typeof fetch;
    render(<GuestFreshnessGuard />);
    firePageShowPersisted();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(FRESHNESS_RELOAD_KEY)).toBe('servedBBBB');
  });

  it('does NOT reload when the server build matches the running build', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ build: 'runningAAAA' }) })) as unknown as typeof fetch;
    render(<GuestFreshnessGuard />);
    firePageShowPersisted();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).not.toHaveBeenCalled();
  });

  it('does NOT reload twice for the same served build (loop guard)', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ build: 'servedBBBB' }) })) as unknown as typeof fetch;
    render(<GuestFreshnessGuard />);
    firePageShowPersisted();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    firePageShowPersisted();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).toHaveBeenCalledTimes(1); // still once
  });

  it('a fetch failure never bounces the guest', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    render(<GuestFreshnessGuard />);
    firePageShowPersisted();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).not.toHaveBeenCalled();
  });
});
