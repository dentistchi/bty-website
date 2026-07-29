// BUILD 20B-WEB7 — the pure saved-song ("내 노래") model.

import { describe, it, expect } from 'vitest';
import {
  SAVED_SONGS_KEY,
  SAVED_SONGS_MAX,
  isValidVideoId,
  parseSavedSongs,
  containsSaved,
  upsertSaved,
  removeSaved,
  dedupeByVideoId,
  fromServerSavedSong,
  type SavedSong,
} from './saved-songs';

const snap = (videoId: string, over: Partial<SavedSong> = {}) => ({
  videoId,
  title: over.title ?? 'Title',
  artist: over.artist ?? 'Artist',
  thumbnailUrl: over.thumbnailUrl ?? null,
});

describe('saved-songs key + validation', () => {
  it('the library key is GLOBAL — no slug, no eventId (survives Room/Event change)', () => {
    expect(SAVED_SONGS_KEY).toBe('bty-karaoke:saved-songs');
    expect(SAVED_SONGS_KEY).not.toContain(':room');
  });

  it('validates YouTube video ids', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('short')).toBe(false);
    expect(isValidVideoId('')).toBe(false);
    expect(isValidVideoId(null)).toBe(false);
  });
});

describe('upsert / remove / contains', () => {
  it('saves a song, newest first', () => {
    let list: SavedSong[] = [];
    list = upsertSaved(list, snap('aaaaaaaaaaa'), 1);
    list = upsertSaved(list, snap('bbbbbbbbbbb'), 2);
    expect(list.map((s) => s.videoId)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
    expect(containsSaved(list, 'aaaaaaaaaaa')).toBe(true);
  });

  it('is idempotent on videoId — re-saving refreshes and bumps, never duplicates', () => {
    let list: SavedSong[] = [];
    list = upsertSaved(list, snap('aaaaaaaaaaa', { title: 'Old' }), 1);
    list = upsertSaved(list, snap('bbbbbbbbbbb'), 2);
    list = upsertSaved(list, snap('aaaaaaaaaaa', { title: 'New' }), 3);
    expect(list).toHaveLength(2);
    expect(list[0].videoId).toBe('aaaaaaaaaaa');
    expect(list[0].title).toBe('New');
  });

  it('remove is idempotent', () => {
    let list = upsertSaved([], snap('aaaaaaaaaaa'), 1);
    list = removeSaved(list, 'aaaaaaaaaaa');
    expect(list).toHaveLength(0);
    expect(removeSaved(list, 'zzzzzzzzzzz')).toHaveLength(0);
  });

  it('ignores invalid video ids on save', () => {
    expect(upsertSaved([], snap('bad'), 1)).toHaveLength(0);
  });

  it('caps at SAVED_SONGS_MAX', () => {
    let list: SavedSong[] = [];
    for (let i = 0; i < SAVED_SONGS_MAX + 10; i++) {
      list = upsertSaved(list, snap(`v${String(i).padStart(10, '0')}`), i);
    }
    expect(list).toHaveLength(SAVED_SONGS_MAX);
  });
});

describe('parse / dedupe / server mapping', () => {
  it('parseSavedSongs tolerates junk and drops invalid ids', () => {
    expect(parseSavedSongs(null)).toEqual([]);
    expect(parseSavedSongs('{bad')).toEqual([]);
    const parsed = parseSavedSongs(
      JSON.stringify([snapWith('aaaaaaaaaaa', 2), snapWith('bad', 1), snapWith('aaaaaaaaaaa', 5)]),
    );
    expect(parsed).toHaveLength(1); // invalid dropped, duplicate collapsed
    expect(parsed[0].videoId).toBe('aaaaaaaaaaa');
  });

  it('dedupeByVideoId keeps first occurrence', () => {
    const out = dedupeByVideoId([
      { videoId: 'a', title: '1', artist: null, thumbnailUrl: null, savedAt: 2 },
      { videoId: 'a', title: '2', artist: null, thumbnailUrl: null, savedAt: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('1');
  });

  it('maps a BUILD 20A server row to the client shape', () => {
    const s = fromServerSavedSong({
      videoId: 'dQw4w9WgXcQ',
      title: 'T',
      artist: 'A',
      thumbnailUrl: 'https://x/y.jpg',
      createdAt: '2026-08-02T00:00:00.000Z',
    });
    expect(s.videoId).toBe('dQw4w9WgXcQ');
    expect(s.savedAt).toBe(Date.parse('2026-08-02T00:00:00.000Z'));
  });
});

function snapWith(videoId: string, savedAt: number) {
  return { videoId, title: 'T', artist: null, thumbnailUrl: null, savedAt };
}
