// @vitest-environment jsdom
//
// BUILD 20B-WEB7 — the AnonymousGuestSavedSongStore is device-local and MUST NOT
// touch any Host credential or authenticated API. These tests fail the build if a
// future edit ever adds a network call to the anonymous save path.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnonymousGuestSavedSongStore } from './saved-song-store';
import { SAVED_SONGS_KEY } from '@/domain/saved-songs';

let clock = 0;
const newStore = () => new AnonymousGuestSavedSongStore(() => ++clock);

beforeEach(() => {
  clock = 0;
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('AnonymousGuestSavedSongStore', () => {
  it('anonymous save uses localStorage only — no fetch / no Host credential', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const store = newStore();
    await store.load();
    await store.save({ videoId: 'dQw4w9WgXcQ', title: 'Never', artist: 'Rick', thumbnailUrl: null });

    expect(fetchSpy).not.toHaveBeenCalled();
    const raw = window.localStorage.getItem(SAVED_SONGS_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain('dQw4w9WgXcQ');
    // The persisted payload carries NO account/host/token field.
    expect(raw!.toLowerCase()).not.toMatch(/token|authorization|accountid|bearer/);
  });

  it('contains() reflects saved state; remove() clears it', async () => {
    const store = newStore();
    await store.load();
    await store.save({ videoId: 'dQw4w9WgXcQ', title: 'T', artist: null, thumbnailUrl: null });
    expect(store.contains('dQw4w9WgXcQ')).toBe(true);
    await store.remove('dQw4w9WgXcQ');
    expect(store.contains('dQw4w9WgXcQ')).toBe(false);
  });

  it('saved songs survive a page refresh (a fresh store re-reads the same key)', async () => {
    const a = newStore();
    await a.load();
    await a.save({ videoId: 'dQw4w9WgXcQ', title: 'T', artist: null, thumbnailUrl: null });

    const b = newStore(); // simulates a reload — new instance, same localStorage
    const list = await b.load();
    expect(list.map((s) => s.videoId)).toContain('dQw4w9WgXcQ');
  });

  it('the library is not scoped to Room/Event — the SAME key serves every room', async () => {
    // There is exactly one global key; changing slug/eventId in the URL cannot
    // change which key the store reads, so the library survives Room/Event change.
    const store = newStore();
    await store.load();
    await store.save({ videoId: 'dQw4w9WgXcQ', title: 'T', artist: null, thumbnailUrl: null });
    const keys = Object.keys(window.localStorage);
    expect(keys).toEqual([SAVED_SONGS_KEY]);
  });

  it('concurrent-safe: a save folds into the freshest on-disk list', async () => {
    const a = newStore();
    const b = newStore();
    await a.load();
    await b.load();
    await a.save({ videoId: 'aaaaaaaaaaa', title: 'A', artist: null, thumbnailUrl: null });
    // b saves without having seen a's write — it must not clobber a's row.
    await b.save({ videoId: 'bbbbbbbbbbb', title: 'B', artist: null, thumbnailUrl: null });
    const fresh = newStore();
    const list = await fresh.load();
    expect(list.map((s) => s.videoId).sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });
});
