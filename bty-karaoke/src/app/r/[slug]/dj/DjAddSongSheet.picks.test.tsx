// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DjAddSongSheet from './DjAddSongSheet';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('DJ song ideas', () => {
  it('reuses the DJ search, preserving original mode and requiring a result before adding', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })));
    const onAddSong = vi.fn(async () => 'ok' as const);
    render(<DjAddSongSheet onAddSong={onAddSong} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Original' }));
    fireEvent.click(screen.getByText('BTY song picks'));
    fireEvent.click(screen.getByRole('button', { name: 'Pop songs' }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Find a track for Perfect by Ed Sheeran' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('q')).toBe('Ed Sheeran Perfect');
    expect(url.searchParams.get('original')).toBe('1');
    expect(onAddSong).not.toHaveBeenCalled();
  });
});
