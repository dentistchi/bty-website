"use client";

import { useEffect, useRef } from "react";

/**
 * Thin wrapper over the OFFICIAL YouTube IFrame Player API. Loads the API once,
 * instantiates one player, and maps PLAYING → onStarted (once) and ENDED →
 * onEnded (once). Official controls/branding are preserved (no overlay, no hidden
 * player, no autoplay). The player is destroyed on unmount. Callbacks are held in
 * refs so identity changes don't tear down the player.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function YouTubePlayer({
  videoId,
  onStarted,
  onEnded,
}: {
  videoId: string;
  onStarted?: () => void;
  onEnded?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const onStartedRef = useRef(onStarted);
  const onEndedRef = useRef(onEnded);
  onStartedRef.current = onStarted;
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    startedRef.current = false;
    endedRef.current = false;

    loadIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            const YT = window.YT;
            if (e.data === YT.PlayerState.PLAYING && !startedRef.current) {
              startedRef.current = true;
              onStartedRef.current?.();
            }
            if (e.data === YT.PlayerState.ENDED && !endedRef.current) {
              endedRef.current = true;
              onEndedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
