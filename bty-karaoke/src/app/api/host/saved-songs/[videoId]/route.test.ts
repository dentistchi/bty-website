// DELETE /api/host/saved-songs/{videoId} — remove a saved song (BUILD 20A).
//
// Pins: account from the session; the path videoId is strictly validated; delete is
// account-scoped and idempotent; an unauthenticated request is a uniform 401.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { account: null as { id: string } | null };

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/, '') ?? null }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: vi.fn(async () => state.account) }));

const deleteSavedSong = vi.fn();
vi.mock('@/lib/saved-songs.server', () => ({ deleteSavedSong: (...a: unknown[]) => deleteSavedSong(...a) }));

import { DELETE } from './route';

function del(videoId: string, auth = 'Bearer tok') {
  const req = new Request(`https://x/api/host/saved-songs/${videoId}`, { method: 'DELETE', headers: { authorization: auth } }) as unknown as import('next/server').NextRequest;
  return DELETE(req, { params: Promise.resolve({ videoId }) });
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  deleteSavedSong.mockReset();
  deleteSavedSong.mockResolvedValue({ deleted: true, videoId: 'dQw4w9WgXcQ' });
});

describe('DELETE /api/host/saved-songs/{videoId}', () => {
  it('(27) unauthenticated → 401, never deletes', async () => {
    state.account = null;
    const res = await del('dQw4w9WgXcQ');
    expect(res.status).toBe(401);
    expect(deleteSavedSong).not.toHaveBeenCalled();
  });

  it('(23) owner delete → success terminal response, scoped by the SESSION account', async () => {
    const res = await del('dQw4w9WgXcQ');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, videoId: 'dQw4w9WgXcQ' });
    expect(deleteSavedSong).toHaveBeenCalledWith('acct-1', 'dQw4w9WgXcQ');
  });

  it('(24/26) a repeated / absent delete returns the SAME success (reveals nothing)', async () => {
    deleteSavedSong.mockResolvedValue({ deleted: true, videoId: 'aaaaaaaaaaa' });
    const res = await del('aaaaaaaaaaa');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, videoId: 'aaaaaaaaaaa' });
  });

  it('(28) invalid path videoId (too short) → 400, never deletes', async () => {
    const res = await del('short');
    expect(res.status).toBe(400);
    expect(deleteSavedSong).not.toHaveBeenCalled();
  });

  it('(28b) invalid path videoId (bad chars) → 400', async () => {
    expect((await del('abc%20defghi')).status).toBe(400);
    expect(deleteSavedSong).not.toHaveBeenCalled();
  });
});
