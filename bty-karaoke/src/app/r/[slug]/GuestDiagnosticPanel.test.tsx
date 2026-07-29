// @vitest-environment jsdom
//
// BUILD 20B-R5 — the path-attribution diagnostic panel. Off by default; on only
// with ?btydiag=1; identifies surface/host/build/component and shows raw→formatted
// metadata without leaking any secret.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import GuestDiagnosticPanel, { isDiagActive } from './GuestDiagnosticPanel';
import type { YoutubeSearchItem } from '@/domain/youtube-search';

const NOISY: YoutubeSearchItem = {
  videoId: 'dQw4w9WgXcQ',
  title: '[TJ노래방] 영원한사랑 - 핑클 / TJ Karaoke',
  channelTitle: 'TJ노래방 공식 유튜브채널',
  thumbnailUrl: null,
};

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search, host: 'norebang.btydaily.com' },
    writable: true,
  });
}

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_KARAOKE_BUILD', 'buildABC123'));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('isDiagActive', () => {
  it('activates only on ?btydiag=1', () => {
    expect(isDiagActive('?btydiag=1')).toBe(true);
    expect(isDiagActive('?btydiag=0')).toBe(false);
    expect(isDiagActive('')).toBe(false);
    expect(isDiagActive('?e=evt-1')).toBe(false);
  });
});

describe('GuestDiagnosticPanel', () => {
  it('renders NOTHING when diagnostics are off (normal UI unchanged)', () => {
    setSearch('');
    const { container } = render(<GuestDiagnosticPanel sample={NOISY} />);
    expect(container.querySelector('[data-bty-diag]')).toBeNull();
  });

  it('identifies WEB surface, host, build, and component when ?btydiag=1', async () => {
    setSearch('?btydiag=1');
    render(<GuestDiagnosticPanel sample={NOISY} />);
    const panel = await screen.findByLabelText('BTY diagnostics');
    expect(panel.getAttribute('data-bty-build')).toBe('buildABC123');
    expect(panel.textContent).toContain('WEB');
    expect(panel.textContent).toContain('norebang.btydaily.com');
    expect(panel.textContent).toContain('buildABC123');
    expect(panel.textContent).toContain('RequestResultCard');
  });

  it('shows raw AND formatted metadata for the sample', async () => {
    setSearch('?btydiag=1');
    render(<GuestDiagnosticPanel sample={NOISY} />);
    await screen.findByLabelText('BTY diagnostics');
    // raw
    expect(screen.getByText('[TJ노래방] 영원한사랑 - 핑클 / TJ Karaoke')).toBeTruthy();
    expect(screen.getByText('TJ노래방 공식 유튜브채널')).toBeTruthy();
    // formatted
    expect(screen.getByText('영원한사랑')).toBeTruthy();
    expect(screen.getByText('핑클')).toBeTruthy();
    expect(screen.getByText('TJ')).toBeTruthy();
  });

  it('never leaks secrets (token/account/email/cancelToken/authorization)', async () => {
    setSearch('?btydiag=1');
    render(<GuestDiagnosticPanel sample={NOISY} />);
    const panel = await screen.findByLabelText('BTY diagnostics');
    expect(panel.textContent!.toLowerCase()).not.toMatch(/token|account|email|authorization|bearer|cancel/);
  });
});
