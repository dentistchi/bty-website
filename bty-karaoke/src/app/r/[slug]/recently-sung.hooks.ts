'use client';

// React glue for the web Guest "방금 부른 노래" surface.
//
// BUILD 20M-WEB8 removed `useSavedSongs` and the anonymous saved-song store: the
// unauthenticated web Guest no longer has a saved-song library. What is left owns the
// Event-scoped Recently Sung list and the in-memory OPTION B proof set, exposing a
// `record()` the dock calls on every poll. This is recent ACTIVITY derived from the
// canonical queue — not a manually curated library.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  recentlySungKey,
  parseRecentlySung,
  addRecentlySung,
  reconcileRecentlySung,
  type RecentlySung,
  type PlayingSnapshot,
  type OwnStatusRow,
} from '@/domain/recently-sung';

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
