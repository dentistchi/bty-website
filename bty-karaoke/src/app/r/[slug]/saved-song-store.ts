'use client';

// The ONE web saved-song store abstraction — BUILD 20B-WEB7 (Phase 2).
//
// A single conceptual interface with two implementations:
//   • AnonymousGuestSavedSongStore — device-local (localStorage). No Host token, no
//     authenticated API, not scoped to Room/Event/guestName/cancelToken. This is the
//     store every ordinary web Guest uses.
//   • AccountSavedSongStore — backed by BUILD 20A (/api/host/saved-songs), used ONLY
//     when a real authenticated account session exists. The account is derived
//     server-side from the session; no accountId ever appears in a client payload.
//
// The /r/[slug] Guest page is anonymous by design (no account session), so the web
// Guest surface wires the Anonymous store. AccountSavedSongStore is implemented and
// unit-testable, but account-backed WEB Guest is DEFERRED — see the report.

import {
  SAVED_SONGS_KEY,
  parseSavedSongs,
  upsertSaved,
  removeSaved,
  containsSaved,
  fromServerSavedSong,
  type SavedSong,
  type SavedSongSnapshot,
} from '@/domain/saved-songs';

export interface SavedSongStore {
  /** Read the persisted library into memory and return it. */
  load(): Promise<SavedSong[]>;
  /** Re-read the canonical source (localStorage / server) and return it. */
  refresh(): Promise<SavedSong[]>;
  /** Synchronous membership check against the in-memory snapshot. */
  contains(videoId: string): boolean;
  /** Persist a save (idempotent on videoId). Resolves with the updated library. */
  save(song: SavedSongSnapshot): Promise<SavedSong[]>;
  /** Persist a removal (idempotent). Resolves with the updated library. */
  remove(videoId: string): Promise<SavedSong[]>;
  /** The current in-memory snapshot (no I/O). */
  items(): SavedSong[];
}

/**
 * Device-local library. Survives refresh, Event change, Room exit, and Guest-session
 * rotation because the key (SAVED_SONGS_KEY) carries no slug/eventId. Storage errors
 * are swallowed — this is presentation-only state, never queue truth.
 */
export class AnonymousGuestSavedSongStore implements SavedSongStore {
  private list: SavedSong[] = [];
  /** Injectable clock so tests are deterministic; defaults to Date.now. */
  constructor(private now: () => number = () => Date.now()) {}

  private read(): SavedSong[] {
    if (typeof window === 'undefined') return [];
    try {
      return parseSavedSongs(window.localStorage.getItem(SAVED_SONGS_KEY));
    } catch {
      return [];
    }
  }

  private write(next: SavedSong[]) {
    this.list = next;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SAVED_SONGS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / disabled — the in-memory list still serves this session */
    }
  }

  async load(): Promise<SavedSong[]> {
    this.list = this.read();
    return this.list;
  }

  async refresh(): Promise<SavedSong[]> {
    return this.load();
  }

  contains(videoId: string): boolean {
    return containsSaved(this.list, videoId);
  }

  async save(song: SavedSongSnapshot): Promise<SavedSong[]> {
    // Fold into the freshest on-disk list so a save never clobbers a concurrent write.
    this.write(upsertSaved(this.read(), song, this.now()));
    return this.list;
  }

  async remove(videoId: string): Promise<SavedSong[]> {
    this.write(removeSaved(this.read(), videoId));
    return this.list;
  }

  items(): SavedSong[] {
    return this.list;
  }
}

/**
 * Account-backed library over BUILD 20A. Used ONLY with a real authenticated session
 * (web cookie). The account is resolved server-side; the client never sends an
 * accountId. Provided for parity/completeness — the anonymous web Guest surface does
 * not instantiate it.
 */
export class AccountSavedSongStore implements SavedSongStore {
  private list: SavedSong[] = [];

  private async fetchList(): Promise<SavedSong[]> {
    const res = await fetch('/api/host/saved-songs', { cache: 'no-store' });
    if (!res.ok) throw new Error('saved-songs list failed');
    const data = (await res.json()) as { savedSongs?: Parameters<typeof fromServerSavedSong>[0][] };
    return (data.savedSongs ?? []).map(fromServerSavedSong).sort((a, b) => b.savedAt - a.savedAt);
  }

  async load(): Promise<SavedSong[]> {
    this.list = await this.fetchList();
    return this.list;
  }

  async refresh(): Promise<SavedSong[]> {
    return this.load();
  }

  contains(videoId: string): boolean {
    return containsSaved(this.list, videoId);
  }

  async save(song: SavedSongSnapshot): Promise<SavedSong[]> {
    const res = await fetch('/api/host/saved-songs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        videoId: song.videoId,
        title: song.title,
        ...(song.artist ? { artist: song.artist } : {}),
        ...(song.thumbnailUrl ? { thumbnailUrl: song.thumbnailUrl } : {}),
      }),
    });
    if (!res.ok) throw new Error('save failed');
    return this.refresh();
  }

  async remove(videoId: string): Promise<SavedSong[]> {
    const res = await fetch(`/api/host/saved-songs/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('remove failed');
    return this.refresh();
  }

  items(): SavedSong[] {
    return this.list;
  }
}
