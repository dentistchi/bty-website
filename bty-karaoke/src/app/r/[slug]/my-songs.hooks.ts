'use client';

// React glue for the web Guest My Songs surfaces — BUILD 20B-WEB7.
//
// `useSavedSongs` owns ONE AnonymousGuestSavedSongStore instance and mirrors it into
// React state, exposing per-videoId pending state so every card that shows the same
// videoId shares one truth. `useRecentlySung` owns the Event-scoped Recently Sung
// list and the in-memory OPTION B proof set, exposing a `record()` the dock calls on
// every poll. All persistence lives behind the pure domain + store modules.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnonymousGuestSavedSongStore } from './saved-song-store';
import type { SavedSong, SavedSongSnapshot } from '@/domain/saved-songs';
import {
  recentlySungKey,
  parseRecentlySung,
  addRecentlySung,
  reconcileRecentlySung,
  type RecentlySung,
  type PlayingSnapshot,
  type OwnStatusRow,
} from '@/domain/recently-sung';

export interface UseSavedSongs {
  items: SavedSong[];
  isSaved: (videoId: string) => boolean;
  isPending: (videoId: string) => boolean;
  save: (song: SavedSongSnapshot) => Promise<void>;
  remove: (videoId: string) => Promise<void>;
  /** Bookmark toggle — saves when absent, removes when present. */
  toggle: (song: SavedSongSnapshot) => Promise<void>;
}

export function useSavedSongs(): UseSavedSongs {
  const storeRef = useRef<AnonymousGuestSavedSongStore | null>(null);
  if (!storeRef.current) storeRef.current = new AnonymousGuestSavedSongStore();
  const store = storeRef.current;

  const [items, setItems] = useState<SavedSong[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    void store.load().then((list) => {
      if (live) setItems(list);
    });
    return () => {
      live = false;
    };
  }, [store]);

  const isSaved = useCallback((videoId: string) => items.some((s) => s.videoId === videoId), [items]);
  const isPending = useCallback((videoId: string) => pending.has(videoId), [pending]);

  const withPending = useCallback(
    async (videoId: string, op: () => Promise<SavedSong[]>) => {
      if (pending.has(videoId)) return; // per-videoId in-flight dedupe
      setPending((prev) => new Set(prev).add(videoId));
      try {
        const next = await op();
        setItems(next);
      } finally {
        setPending((prev) => {
          const n = new Set(prev);
          n.delete(videoId);
          return n;
        });
      }
    },
    [pending],
  );

  const save = useCallback(
    (song: SavedSongSnapshot) => withPending(song.videoId, () => store.save(song)),
    [store, withPending],
  );
  const remove = useCallback(
    (videoId: string) => withPending(videoId, () => store.remove(videoId)),
    [store, withPending],
  );
  const toggle = useCallback(
    (song: SavedSongSnapshot) =>
      withPending(song.videoId, () =>
        store.contains(song.videoId) ? store.remove(song.videoId) : store.save(song),
      ),
    [store, withPending],
  );

  return useMemo(
    () => ({ items, isSaved, isPending, save, remove, toggle }),
    [items, isSaved, isPending, save, remove, toggle],
  );
}

export interface RecordInput {
  own: readonly OwnStatusRow[];
  eventActive: boolean;
  pollOk: boolean;
}

export interface UseRecentlySung {
  items: RecentlySung[];
  /** Called by the dock on each poll; commits any newly-completed performance. */
  record: (input: RecordInput) => void;
}

export function useRecentlySung(slug: string, eventId: string | null): UseRecentlySung {
  const [items, setItems] = useState<RecentlySung[]>([]);
  const unresolvedRef = useRef<Record<string, PlayingSnapshot>>({});

  // Load the Event-scoped list and RESET the in-memory proof set whenever the Event
  // (or Room) changes — a proof witnessed under Event A can never record into Event B.
  useEffect(() => {
    unresolvedRef.current = {};
    if (typeof window === 'undefined') return;
    try {
      setItems(parseRecentlySung(window.localStorage.getItem(recentlySungKey(slug, eventId))));
    } catch {
      setItems([]);
    }
  }, [slug, eventId]);

  const record = useCallback(
    ({ own, eventActive, pollOk }: RecordInput) => {
      const { unresolved, recorded } = reconcileRecentlySung({
        own,
        unresolved: unresolvedRef.current,
        eventActive,
        pollOk,
        nowMs: Date.now(),
      });
      unresolvedRef.current = unresolved;
      if (recorded.length === 0) return;
      setItems((prev) => {
        let next = prev;
        for (const r of recorded) next = addRecentlySung(next, r);
        try {
          window.localStorage.setItem(recentlySungKey(slug, eventId), JSON.stringify(next));
        } catch {
          /* presentation only */
        }
        return next;
      });
    },
    [slug, eventId],
  );

  return useMemo(() => ({ items, record }), [items, record]);
}
