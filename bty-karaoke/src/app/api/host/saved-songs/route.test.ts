// POST + GET /api/host/saved-songs — My Songs collection (BUILD 20A).
//
// Pins: the account is derived from the SESSION (never the body); a strict schema
// rejects any ownership field and validates videoId/title/artist/thumbnail; an
// unauthenticated request is a uniform 401; the response exposes only the public
// saved-song projection. The real SaveSongSchema runs (only auth + service are mocked).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { account: null as { id: string } | null };

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/, '') ?? null }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: vi.fn(async () => state.account) }));

const saveSavedSong = vi.fn();
const listSavedSongs = vi.fn();
vi.mock('@/lib/saved-songs.server', () => ({
  saveSavedSong: (...a: unknown[]) => saveSavedSong(...a),
  listSavedSongs: (...a: unknown[]) => listSavedSongs(...a),
}));

import { POST, GET } from './route';

const VALID = { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' };

function post(body?: unknown, auth = 'Bearer tok') {
  return new Request('https://x/api/host/saved-songs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}
function get(auth = 'Bearer tok') {
  return new Request('https://x/api/host/saved-songs', { method: 'GET', headers: { authorization: auth } }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  state.account = { id: 'acct-1' };
  saveSavedSong.mockReset();
  listSavedSongs.mockReset();
});

describe('POST /api/host/saved-songs', () => {
  it('(2) unauthenticated → 401, never saves', async () => {
    state.account = null;
    const res = await POST(post(VALID));
    expect(res.status).toBe(401);
    expect(saveSavedSong).not.toHaveBeenCalled();
  });

  it('(3) invalid/expired session (authorizeHost→null) → 401', async () => {
    state.account = null;
    expect((await POST(post(VALID))).status).toBe(401);
  });

  it('(1) authenticated save creates one item and returns the public projection', async () => {
    saveSavedSong.mockResolvedValue({ videoId: VALID.videoId, title: VALID.title, artist: VALID.artist, thumbnailUrl: VALID.thumbnailUrl, createdAt: 't1', updatedAt: 't1' });
    const res = await POST(post(VALID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.savedSong).toEqual({ videoId: VALID.videoId, title: VALID.title, artist: VALID.artist, thumbnailUrl: VALID.thumbnailUrl, createdAt: 't1', updatedAt: 't1' });
    expect(saveSavedSong).toHaveBeenCalledTimes(1);
    // never leaks account_id / email / provider
    expect(JSON.stringify(body)).not.toMatch(/account|email|provider|token/i);
  });

  it('(4) derives the account from the session — a body accountId is rejected by strict schema, never forwarded', async () => {
    const res = await POST(post({ ...VALID, accountId: 'attacker' }));
    // strict schema → unknown key rejected
    expect(res.status).toBe(400);
    expect(saveSavedSong).not.toHaveBeenCalled();
  });

  it('(4b) rejects other ownership fields (roomId/eventId/requestId/cancelToken)', async () => {
    for (const extra of [{ roomId: 'r' }, { eventId: 'e' }, { requestId: 'q' }, { cancelToken: 'c' }]) {
      const res = await POST(post({ ...VALID, ...extra }));
      expect(res.status).toBe(400);
    }
    expect(saveSavedSong).not.toHaveBeenCalled();
  });

  it('(4c) a clean body forwards the SESSION account id, not anything client-supplied', async () => {
    saveSavedSong.mockResolvedValue({ videoId: VALID.videoId, title: VALID.title, artist: VALID.artist, thumbnailUrl: VALID.thumbnailUrl, createdAt: 't', updatedAt: 't' });
    await POST(post(VALID));
    expect(saveSavedSong).toHaveBeenCalledWith('acct-1', { videoId: VALID.videoId, title: VALID.title, artist: VALID.artist, thumbnailUrl: VALID.thumbnailUrl });
  });

  it('(5) too-short videoId → 400', async () => {
    expect((await POST(post({ ...VALID, videoId: 'short' }))).status).toBe(400);
    expect(saveSavedSong).not.toHaveBeenCalled();
  });
  it('(6) too-long videoId → 400', async () => {
    expect((await POST(post({ ...VALID, videoId: 'dQw4w9WgXcQEXTRA' }))).status).toBe(400);
  });
  it('(7) invalid-character videoId → 400', async () => {
    expect((await POST(post({ ...VALID, videoId: 'abcd efgh!!' }))).status).toBe(400);
  });
  it('(8) empty title → 400', async () => {
    expect((await POST(post({ ...VALID, title: '   ' }))).status).toBe(400);
  });
  it('(9) oversized title (>300) → 400', async () => {
    expect((await POST(post({ ...VALID, title: 'x'.repeat(301) }))).status).toBe(400);
  });
  it('(10) oversized artist (>200) → 400', async () => {
    expect((await POST(post({ ...VALID, artist: 'x'.repeat(201) }))).status).toBe(400);
  });
  it('(11) invalid thumbnail URL → 400', async () => {
    expect((await POST(post({ ...VALID, thumbnailUrl: 'not-a-url' }))).status).toBe(400);
  });
  it('(11b) non-https thumbnail URL → 400', async () => {
    expect((await POST(post({ ...VALID, thumbnailUrl: 'http://img.youtube.com/x.jpg' }))).status).toBe(400);
  });
  it('(12) oversized thumbnail URL (>600) → 400', async () => {
    expect((await POST(post({ ...VALID, thumbnailUrl: 'https://x.com/' + 'a'.repeat(600) }))).status).toBe(400);
  });

  it('artist + thumbnail are optional (omitted → forwarded as null)', async () => {
    saveSavedSong.mockResolvedValue({ videoId: VALID.videoId, title: VALID.title, artist: null, thumbnailUrl: null, createdAt: 't', updatedAt: 't' });
    const res = await POST(post({ videoId: VALID.videoId, title: VALID.title }));
    expect(res.status).toBe(200);
    expect(saveSavedSong).toHaveBeenCalledWith('acct-1', { videoId: VALID.videoId, title: VALID.title, artist: null, thumbnailUrl: null });
  });

  it('(13/14) a repeated save returns success + the canonical item (idempotent at the API)', async () => {
    saveSavedSong.mockResolvedValue({ videoId: VALID.videoId, title: VALID.title, artist: VALID.artist, thumbnailUrl: VALID.thumbnailUrl, createdAt: 't1', updatedAt: 't2' });
    const res = await POST(post(VALID));
    expect(res.status).toBe(200);
    expect((await res.json()).savedSong.videoId).toBe(VALID.videoId);
  });

  it('malformed JSON body → 400', async () => {
    const bad = new Request('https://x/api/host/saved-songs', { method: 'POST', headers: { authorization: 'Bearer tok' }, body: '{' }) as unknown as import('next/server').NextRequest;
    expect((await POST(bad)).status).toBe(400);
  });
});

describe('GET /api/host/saved-songs', () => {
  it('(22) unauthenticated → 401, never lists', async () => {
    state.account = null;
    expect((await GET(get())).status).toBe(401);
    expect(listSavedSongs).not.toHaveBeenCalled();
  });

  it('(18/19) lists ONLY the session account (never a client-supplied one)', async () => {
    listSavedSongs.mockResolvedValue([{ videoId: 'aaaaaaaaaaa', title: 'A', artist: null, thumbnailUrl: null, createdAt: 't', updatedAt: 't' }]);
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(listSavedSongs).toHaveBeenCalledWith('acct-1');
    const body = await res.json();
    expect(body.savedSongs).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/account|email|provider/i);
  });

  it('(20) empty library → { savedSongs: [] }', async () => {
    listSavedSongs.mockResolvedValue([]);
    const res = await GET(get());
    expect(await res.json()).toEqual({ savedSongs: [] });
  });
});
