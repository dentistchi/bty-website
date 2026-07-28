// saved-songs.server — My Songs service behaviour (BUILD 20A), proved against a fake
// Postgres that models the real invariants:
//   * UNIQUE(account_id, video_id) — a repeat save updates, never duplicates
//   * created_at preserved on a metadata refresh; updated_at advances
//   * list is account-scoped, ordered created_at DESC then id DESC
//   * delete is account-scoped (account_id + video_id), idempotent, reveals nothing
//   * the service touches ONE table and nothing else (no requests/room/event/queue)

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { [k: string]: unknown }

const db = { rows: [] as Row[], seq: 0, touched: new Set<string>() };
// Injectable created_at source (default: monotonically increasing so order is defined).
let clockSeq = 0;
let clock = () => `2026-01-01T00:00:${String(++clockSeq).padStart(2, '0')}.000Z`;

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    from(table: string) {
      db.touched.add(table);
      let op: 'select' | 'upsert' | 'delete' = 'select';
      let upsertRow: Row | null = null;
      const eqs: Array<[string, unknown]> = [];

      const matched = () => db.rows.filter((r) => eqs.every(([c, v]) => r[c] === v));

      const applyUpsert = () => {
        const accountId = upsertRow!.account_id;
        const videoId = upsertRow!.video_id;
        const existing = db.rows.find((r) => r.account_id === accountId && r.video_id === videoId);
        if (existing) {
          // ON CONFLICT DO UPDATE — refresh snapshots + updated_at, PRESERVE created_at + id.
          existing.title_snapshot = upsertRow!.title_snapshot;
          existing.artist_snapshot = upsertRow!.artist_snapshot;
          existing.thumbnail_url_snapshot = upsertRow!.thumbnail_url_snapshot;
          existing.updated_at = upsertRow!.updated_at;
          return { data: existing, error: null };
        }
        const row: Row = { id: `id-${String(++db.seq).padStart(4, '0')}`, created_at: clock(), ...upsertRow };
        db.rows.push(row);
        return { data: row, error: null };
      };

      const b = {
        upsert: (row: Row) => { op = 'upsert'; upsertRow = row; return b; },
        select: () => b,
        delete: () => { op = 'delete'; return b; },
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
        order: () => b,
        single: async () => (op === 'upsert' ? applyUpsert() : { data: matched()[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          if (op === 'delete') {
            const rows = matched();
            for (const r of rows) { const i = db.rows.indexOf(r); if (i >= 0) db.rows.splice(i, 1); }
            return Promise.resolve(resolve({ data: rows, error: null }));
          }
          // select (list): created_at DESC, then id DESC
          const rows = matched().slice().sort(
            (a, b2) => String(b2.created_at).localeCompare(String(a.created_at)) || String(b2.id).localeCompare(String(a.id)),
          );
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
      return b;
    },
  }),
}));

import { saveSavedSong, listSavedSongs, deleteSavedSong } from './saved-songs.server';

const SONG = { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' };

beforeEach(() => {
  db.rows = []; db.seq = 0; db.touched = new Set();
  clockSeq = 0;
  clock = () => `2026-01-01T00:00:${String(++clockSeq).padStart(2, '0')}.000Z`;
});

describe('saveSavedSong', () => {
  it('creates one row and returns the public projection (no account_id leak)', async () => {
    const saved = await saveSavedSong('acct-1', SONG);
    expect(db.rows).toHaveLength(1);
    expect(saved).toMatchObject({ videoId: SONG.videoId, title: SONG.title, artist: SONG.artist, thumbnailUrl: SONG.thumbnailUrl });
    expect(saved).toHaveProperty('createdAt');
    expect(saved).toHaveProperty('updatedAt');
    expect(Object.keys(saved)).not.toContain('account_id');
    expect(Object.keys(saved)).not.toContain('id');
  });

  it('(13) a repeated save creates NO second row (idempotent on account+videoId)', async () => {
    await saveSavedSong('acct-1', SONG);
    await saveSavedSong('acct-1', SONG);
    await saveSavedSong('acct-1', SONG);
    expect(db.rows).toHaveLength(1);
  });

  it('(15/16) a repeated save refreshes the snapshots + updated_at but PRESERVES created_at', async () => {
    const first = await saveSavedSong('acct-1', SONG);
    await new Promise((r) => setTimeout(r, 2)); // ensure updated_at can differ
    const second = await saveSavedSong('acct-1', { ...SONG, title: 'New Title', artist: 'New Artist' });
    expect(db.rows).toHaveLength(1);
    expect(second.title).toBe('New Title');
    expect(second.artist).toBe('New Artist');
    expect(second.createdAt).toBe(first.createdAt);          // order-stable
    expect(second.updatedAt >= first.updatedAt).toBe(true);  // advanced
  });

  it('(17) two accounts save the SAME video independently → two rows', async () => {
    await saveSavedSong('acct-A', SONG);
    await saveSavedSong('acct-B', SONG);
    expect(db.rows).toHaveLength(2);
    expect(db.rows.filter((r) => r.video_id === SONG.videoId)).toHaveLength(2);
  });

  it('(29-33) save touches ONLY karaoke_user_saved_songs (no requests/room/event/queue/entitlement)', async () => {
    await saveSavedSong('acct-1', SONG);
    expect([...db.touched]).toEqual(['karaoke_user_saved_songs']);
  });
});

describe('listSavedSongs', () => {
  it('(18/19) returns ONLY the caller account’s rows', async () => {
    await saveSavedSong('acct-A', { ...SONG, videoId: 'aaaaaaaaaaa' });
    await saveSavedSong('acct-B', { ...SONG, videoId: 'bbbbbbbbbbb' });
    const listA = await listSavedSongs('acct-A');
    expect(listA.map((s) => s.videoId)).toEqual(['aaaaaaaaaaa']);
    const listB = await listSavedSongs('acct-B');
    expect(listB.map((s) => s.videoId)).toEqual(['bbbbbbbbbbb']);
  });

  it('(20) an empty library returns []', async () => {
    expect(await listSavedSongs('nobody')).toEqual([]);
  });

  it('(21) orders created_at DESC (newest first)', async () => {
    await saveSavedSong('acct-1', { ...SONG, videoId: 'first000000' });
    await saveSavedSong('acct-1', { ...SONG, videoId: 'second00000' });
    await saveSavedSong('acct-1', { ...SONG, videoId: 'third000000' });
    expect((await listSavedSongs('acct-1')).map((s) => s.videoId)).toEqual(['third000000', 'second00000', 'first000000']);
  });

  it('(21b) breaks an equal-created_at tie by id DESC (deterministic order)', async () => {
    clock = () => '2026-01-01T00:00:00.000Z'; // same created_at for both inserts
    await saveSavedSong('acct-1', { ...SONG, videoId: 'tievideo001' }); // id-0001
    await saveSavedSong('acct-1', { ...SONG, videoId: 'tievideo002' }); // id-0002
    expect((await listSavedSongs('acct-1')).map((s) => s.videoId)).toEqual(['tievideo002', 'tievideo001']);
  });
});

describe('deleteSavedSong', () => {
  it('(23) removes the caller’s own row and returns terminal success', async () => {
    await saveSavedSong('acct-1', SONG);
    const res = await deleteSavedSong('acct-1', SONG.videoId);
    expect(res).toEqual({ deleted: true, videoId: SONG.videoId });
    expect(db.rows).toHaveLength(0);
  });

  it('(24) a repeated / absent delete returns the SAME success (idempotent)', async () => {
    await saveSavedSong('acct-1', SONG);
    await deleteSavedSong('acct-1', SONG.videoId);
    const again = await deleteSavedSong('acct-1', SONG.videoId);
    expect(again).toEqual({ deleted: true, videoId: SONG.videoId });
  });

  it('(25/26) account B cannot delete account A’s row; the call still returns success (reveals nothing)', async () => {
    await saveSavedSong('acct-A', SONG);
    const res = await deleteSavedSong('acct-B', SONG.videoId); // scoped by account_id + video_id
    expect(res).toEqual({ deleted: true, videoId: SONG.videoId }); // same success either way
    expect(db.rows).toHaveLength(1); // A's row is untouched
    expect(db.rows[0].account_id).toBe('acct-A');
  });

  it('(30-33) delete touches ONLY karaoke_user_saved_songs', async () => {
    await saveSavedSong('acct-1', SONG);
    db.touched = new Set();
    await deleteSavedSong('acct-1', SONG.videoId);
    expect([...db.touched]).toEqual(['karaoke_user_saved_songs']);
  });
});
