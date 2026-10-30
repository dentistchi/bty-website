// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DjBoard from './DjBoard';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function props(role: 'admin' | 'dj' = 'admin'): ComponentProps<typeof DjBoard> {
  return {
    slug: 'test-room',
    displayName: 'Test room',
    data: {
      room: { display_name: 'Test room', status: 'open' },
      role,
      session: null,
      stats: { requests: 0, guests: 0 },
      requests: [],
      eventStatus: null,
    },
    newIds: [], reconnecting: false, busy: false, error: null,
    adminCred: role === 'admin' ? 'test-admin-capability' : null,
    onMoveNext: vi.fn(), onRemove: vi.fn(), onRefresh: vi.fn(),
    onDisconnect: vi.fn(), onPlayNext: vi.fn(),
    onReorder: vi.fn(async () => 'ok' as const),
    onAddSong: vi.fn(async () => 'ok' as const),
    onEndEvent: vi.fn(async () => 'ok' as const),
    onStartNewEvent: vi.fn(async () => 'ok' as const),
  };
}

describe('Main room song-picks entry', () => {
  it('opens an expanded Korean catalog in one click, then searches only after selecting a song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })));
    const boardProps = props();
    render(<DjBoard {...boardProps} />);

    const actions = screen.getByRole('group', { name: 'Admin actions' });
    fireEvent.click(within(actions).getByRole('button', { name: '🎵 추천곡 60곡' }));

    const dialog = screen.getByRole('dialog', { name: 'Add a song to the queue' });
    const panel = within(dialog).getByText('BTY 추천곡').closest('details')!;
    expect(panel.open).toBe(true);
    expect(within(dialog).getByRole('group', { name: '추천곡 분류' }).children).toHaveLength(6);
    expect(within(dialog).getByRole('list', { name: '다 같이 부르기' }).children).toHaveLength(10);
    expect(fetch).not.toHaveBeenCalled();
    expect(boardProps.onAddSong).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'DAY6 한 페이지가 될 수 있게 반주 찾기' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('q')).toBe('DAY6 한 페이지가 될 수 있게');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Search' }).hasAttribute('disabled')).toBe(false));
    expect(panel.open).toBe(false);
    expect(boardProps.onAddSong).not.toHaveBeenCalled();
  });

  it('keeps the direct add-song entry restricted to the existing admin role', () => {
    render(<DjBoard {...props('dj')} />);
    expect(screen.queryByRole('button', { name: '🎵 추천곡 60곡' })).toBeNull();
  });
});
