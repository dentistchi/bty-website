"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ManagerSnapshot } from "./types";

/**
 * Manager control-room snapshot with bounded, visibility-guarded polling.
 *
 * Roster refresh strategy (per spec §14): existing realtime is NOT used here —
 * the roster is owner-private and read through the authenticated server route, so
 * a client Supabase subscription would need to expose it. Bounded polling of the
 * owner snapshot is the safe, established fallback:
 *   - polls only while the document is visible AND the event is open
 *   - pauses on tab-hide (visibilitychange), resumes with an immediate refresh
 *   - never overlaps requests (in-flight guard)
 *   - stops entirely once the event is closed
 */
const POLL_MS = 3000;

export function useEventSnapshot(eventId: string, initial?: ManagerSnapshot | null) {
  const [snapshot, setSnapshot] = useState<ManagerSnapshot | null>(initial ?? null);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (mounted.current) setError(true);
        return;
      }
      const data = (await res.json()) as ManagerSnapshot;
      if (mounted.current && data?.event) {
        setSnapshot(data);
        setError(false);
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      inFlight.current = false;
    }
  }, [eventId]);

  useEffect(() => {
    mounted.current = true;
    // Always fetch a fresh snapshot on mount (cold restore / re-entry).
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const isOpen = snapshot?.event?.status !== "closed";

  useEffect(() => {
    if (!isOpen) return; // stop polling once closed
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void refresh();
        }
      }, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh(); // immediate catch-up on return
        start();
      } else {
        stop();
      }
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOpen, refresh]);

  return { snapshot, setSnapshot, refresh, error };
}
