import { describe, it, expect, vi, beforeEach } from 'vitest';

// BUILD 26T-R1B-R6-R1B-R6 §F/§G/§N — the stable-id delete path.
//
// The conflict this closes: after a retention transition `video_id` is NULL, so the videoId-keyed
// route can no longer address the row and the owner is permanently unable to delete their own
// library entry. The security property that matters most here is that a STABLE UUID is now the
// key — so the ownership predicate is the only thing standing between a guessed UUID and someone
// else's row.

const calls: Array<{ table: string; op: string; filters: Record<string, unknown> }> = [];

function fakeDb() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain = {
        delete() {
          calls.push({ table, op: 'delete', filters });
          return chain;
        },
        select() {
          calls.push({ table, op: 'select', filters });
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        order() {
          return chain;
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return chain;
    },
  };
}

vi.mock('./supabase.server', () => ({ karaokeDb: () => fakeDb() }));

const { deleteSavedSongById, deleteSavedSong } = await import('./saved-songs.server');

beforeEach(() => {
  calls.length = 0;
});

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const ROW = '22222222-2222-4222-8222-222222222222';

describe('§N stable-id delete', () => {
  it('N1/N2: deletes by row id — no YouTube video id is required at all', async () => {
    // N2 is the whole point: this works for a row whose video_id is NULL.
    const r = await deleteSavedSongById(ACCOUNT, ROW);
    expect(r).toEqual({ deleted: true, savedSongId: ROW });
    const del = calls.find((c) => c.op === 'delete')!;
    expect(del.filters).not.toHaveProperty('video_id');
  });

  it('N3/MUTANT: the delete is scoped by BOTH id AND account_id', async () => {
    // Removing the ownership predicate is the mutant this kills: with a stable UUID as the key,
    // an id-only delete would let any authenticated account delete any row it could guess.
    await deleteSavedSongById(ACCOUNT, ROW);
    const del = calls.find((c) => c.op === 'delete')!;
    expect(del.filters.id).toBe(ROW);
    expect(del.filters.account_id, 'THE ownership predicate').toBe(ACCOUNT);
    expect(Object.keys(del.filters).sort()).toEqual(['account_id', 'id']);
  });

  it('N4: an absent row returns the same terminal success — nothing is disclosed', async () => {
    const a = await deleteSavedSongById(ACCOUNT, ROW);
    const b = await deleteSavedSongById(ACCOUNT, '33333333-3333-4333-8333-333333333333');
    expect(a.deleted).toBe(true);
    expect(b.deleted).toBe(true);
  });

  it('N6: the legacy videoId path is untouched and still scoped by account', async () => {
    await deleteSavedSong(ACCOUNT, 'dQw4w9WgXcQ');
    const del = calls.find((c) => c.op === 'delete')!;
    expect(del.filters.account_id).toBe(ACCOUNT);
    expect(del.filters.video_id).toBe('dQw4w9WgXcQ');
  });
});

describe('§G the library response model', () => {
  it('N5: a malformed id never reaches the database — the route validates UUID form', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/app/api/host/saved-songs/by-id/[savedSongId]/route.ts', 'utf8'),
    );
    expect(src).toMatch(/UUID\s*=\s*\/\^\[0-9a-fA-F\]\{8\}/);
    expect(src).toMatch(/if \(!UUID\.test\(savedSongId \?\? ''\)\)/);
    // Fails closed BEFORE the service call.
    expect(src.indexOf('UUID.test')).toBeLessThan(src.indexOf('deleteSavedSongById(acct.id'));
  });

  it('N7/N8: the projection exposes the stable id and NEVER a provenance seal', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/saved-songs.server.ts', 'utf8'));
    expect(src).toMatch(/savedSongId: r\.id/);
    expect(src).toMatch(/youtubeUnavailable: r\.youtube_metadata_unavailable_at != null/);
    // The seal is a WRITE credential. It must never travel back out as library state.
    expect(src).not.toMatch(/youtubeProvenance:\s*r\./);
    expect(src).not.toMatch(/provenance:\s*r\.youtube/);
  });

  it('§G: cleared fields are returned as null — no manufactured placeholders', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/saved-songs.server.ts', 'utf8'));
    expect(src).toMatch(/videoId: r\.video_id \?\? null/);
    expect(src).toMatch(/title: r\.title_snapshot \?\? null/);
    // A placeholder string would be indistinguishable from a real value downstream.
    expect(src).not.toMatch(/title_snapshot \?\? '[^']/);
  });
});

describe('§E the unavailable start authority', () => {
  it('every start path routes through the ONE guard in beginSong', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/metering.server.ts', 'utf8'));
    // The guard is the FIRST thing beginSong does — before any lifecycle or metering work.
    const fn = src.slice(src.indexOf('export async function beginSong'));
    const guard = fn.indexOf('requestYoutubeUnavailable');
    const work = fn.indexOf('roomOwnerAccountId');
    expect(guard).toBeGreaterThan(-1);
    expect(guard, 'the guard must precede any metering work').toBeLessThan(work);
  });

  it('the guard reads the EXPLICIT marker, not a NULL video id', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/metering.server.ts', 'utf8'));
    const fn = src.slice(src.indexOf('async function requestYoutubeUnavailable'));
    expect(fn).toMatch(/youtube_metadata_unavailable_at/);
    // `youtube_video_id IS NULL` would also be true for legacy/incomplete rows — a different and
    // wrong rule.
    expect(fn.slice(0, 600)).not.toMatch(/select\('youtube_video_id'\)/);
  });

  it('the guard is scoped by room AND request — never request id alone', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/metering.server.ts', 'utf8'));
    const fn = src.slice(src.indexOf('async function requestYoutubeUnavailable'));
    expect(fn).toMatch(/\.eq\('id', requestId\)/);
    expect(fn).toMatch(/\.eq\('room_id', roomId\)/);
  });

  it('historical lifecycle facts are NOT rewritten to express unavailability', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/lib/metering.server.ts', 'utf8'));
    const fn = src.slice(src.indexOf('export async function beginSong'), src.indexOf('/** v2 begin'));
    // The guard returns; it never updates status, ready_at, or any lifecycle column.
    expect(fn).not.toMatch(/\.update\(/);
  });
});
