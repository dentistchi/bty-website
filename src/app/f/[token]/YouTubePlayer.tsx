"use client";

import { useEffect, useRef, useState } from "react";
import {
  classifyYoutubePlayerError,
  foundryPlayerVars,
  type YoutubePlayerErrorKind,
} from "@/domain/foundry/youtube";
import {
  createWatchAccumulator,
  recordTick,
  setDuration,
  markReachedEnd,
  computeWatchIntegrity,
  computeCheckpoints,
  type CompletionState,
  type WatchCheckpoint,
} from "@/domain/foundry/watch-integrity";
import {
  enterFullscreen,
  exitNativeFullscreen,
  currentFullscreenElement,
  isNativeFullscreenActive,
} from "@/lib/native/fullscreen";

/**
 * Thin wrapper over the OFFICIAL YouTube IFrame Player API. Loads the API once,
 * instantiates one player, and maps PLAYING → onStarted (once) and ENDED →
 * onEnded (once). Official controls/branding are preserved.
 *
 * Immersive Learning V1 additions (all client-side, all EPHEMERAL — no telemetry
 * ever leaves this component):
 *   - Watch Integrity Engine: polls currentTime/duration while playing to derive
 *     a CompletionState (pass/review/incomplete), emitted once on ENDED.
 *   - onPlayingChange: lets the parent drive wake-lock + immersive UI hiding.
 *   - One-tap fullscreen button.
 *   - Playback resume: restores the last position from sessionStorage.
 *   - Optional checkpoints: pauses once at a mid-video mark and invites a
 *     reflection, then resumes (never mandatory).
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

const POLL_MS = 750;
const RESUME_MIN_SECONDS = 8; // don't bother resuming a near-start position
const RESUME_TAIL_SECONDS = 15; // don't resume right at the end

function resumeKey(videoId: string): string {
  return `bty_fr_pos_${videoId}`;
}

function readResumePosition(videoId: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(resumeKey(videoId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeResumePosition(videoId: string, seconds: number): void {
  try {
    window.sessionStorage.setItem(resumeKey(videoId), String(Math.floor(seconds)));
  } catch {
    /* ignore */
  }
}

function clearResumePosition(videoId: string): void {
  try {
    window.sessionStorage.removeItem(resumeKey(videoId));
  } catch {
    /* ignore */
  }
}

export function YouTubePlayer({
  videoId,
  onStarted,
  onEnded,
  onError,
  onIntegrity,
  onPlayingChange,
  onCheckpoint,
  enableResume = true,
}: {
  videoId: string;
  onStarted?: () => void;
  onEnded?: () => void;
  onError?: (kind: YoutubePlayerErrorKind, rawCode: number) => void;
  /** Derived watch meaning, emitted once when the video ends. */
  onIntegrity?: (state: CompletionState) => void;
  /** True while playing, false on pause/end — drives wake-lock + immersive UI. */
  onPlayingChange?: (playing: boolean) => void;
  /** Fires once per checkpoint; call `resume()` to continue playback. */
  onCheckpoint?: (index: number, resume: () => void) => void;
  enableResume?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const startedRef = useRef(false);
  const endedRef = useRef(false);

  const onStartedRef = useRef(onStarted);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onIntegrityRef = useRef(onIntegrity);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onCheckpointRef = useRef(onCheckpoint);
  onStartedRef.current = onStarted;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onIntegrityRef.current = onIntegrity;
  onPlayingChangeRef.current = onPlayingChange;
  onCheckpointRef.current = onCheckpoint;

  // Ephemeral watch evidence — never persisted, never leaves the component.
  const accRef = useRef(createWatchAccumulator());
  const checkpointsRef = useRef<WatchCheckpoint[]>([]);
  const firedCheckpointsRef = useRef<Set<number>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  // In-app immersive fallback for platforms without element-fullscreen (iPhone/WKWebView).
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startedRef.current = false;
    endedRef.current = false;
    accRef.current = createWatchAccumulator();
    firedCheckpointsRef.current = new Set();
    checkpointsRef.current = [];

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const sampleOnce = () => {
      const p = playerRef.current;
      if (!p) return;
      let pos = 0;
      let dur = 0;
      try {
        pos = typeof p.getCurrentTime === "function" ? p.getCurrentTime() : 0;
        dur = typeof p.getDuration === "function" ? p.getDuration() : 0;
      } catch {
        return;
      }
      if (dur > 0) {
        accRef.current = setDuration(accRef.current, dur);
        if (checkpointsRef.current.length === 0) {
          checkpointsRef.current = computeCheckpoints(dur);
        }
      }
      accRef.current = recordTick(accRef.current, pos);
      if (enableResume) writeResumePosition(videoId, pos);

      // Checkpoints — fire once, pause, invite, resume.
      if (onCheckpointRef.current) {
        for (const cp of checkpointsRef.current) {
          if (!firedCheckpointsRef.current.has(cp.index) && pos >= cp.atSeconds) {
            firedCheckpointsRef.current.add(cp.index);
            try {
              p.pauseVideo?.();
            } catch {
              /* ignore */
            }
            onCheckpointRef.current(cp.index, () => {
              try {
                playerRef.current?.playVideo?.();
              } catch {
                /* ignore */
              }
            });
            break;
          }
        }
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(sampleOnce, POLL_MS);
    };

    loadIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        playerVars: foundryPlayerVars(window.location.origin),
        events: {
          onReady: () => {
            if (cancelled) return;
            // Ensure the generated iframe permits fullscreen (the YT native control
            // + any element-fullscreen path depend on this). Idempotent.
            try {
              const iframe: HTMLIFrameElement | undefined = playerRef.current?.getIframe?.();
              if (iframe) {
                iframe.setAttribute("allowfullscreen", "");
                iframe.setAttribute("webkitallowfullscreen", "");
                const allow = iframe.getAttribute("allow") ?? "";
                if (!/\bfullscreen\b/.test(allow)) {
                  iframe.setAttribute("allow", allow ? `${allow}; fullscreen` : "fullscreen");
                }
              }
            } catch {
              /* ignore */
            }
            if (!enableResume) return;
            const resumeAt = readResumePosition(videoId);
            const p = playerRef.current;
            if (resumeAt == null || !p) return;
            try {
              const dur = typeof p.getDuration === "function" ? p.getDuration() : 0;
              if (resumeAt >= RESUME_MIN_SECONDS && (dur === 0 || resumeAt < dur - RESUME_TAIL_SECONDS)) {
                p.seekTo?.(resumeAt, true);
              }
            } catch {
              /* ignore */
            }
          },
          onStateChange: (e: { data: number }) => {
            const YT = window.YT;
            if (e.data === YT.PlayerState.PLAYING) {
              if (!startedRef.current) {
                startedRef.current = true;
                onStartedRef.current?.();
              }
              onPlayingChangeRef.current?.(true);
              startPolling();
            }
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.BUFFERING) {
              onPlayingChangeRef.current?.(false);
              if (e.data === YT.PlayerState.PAUSED) stopPolling();
            }
            if (e.data === YT.PlayerState.ENDED && !endedRef.current) {
              endedRef.current = true;
              stopPolling();
              sampleOnce();
              accRef.current = markReachedEnd(accRef.current);
              onPlayingChangeRef.current?.(false);
              clearResumePosition(videoId);
              onIntegrityRef.current?.(computeWatchIntegrity(accRef.current).completionState);
              onEndedRef.current?.();
            }
          },
          onError: (e: { data: number }) => {
            onErrorRef.current?.(classifyYoutubePlayerError(e.data), e.data);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      stopPolling();
      onPlayingChangeRef.current?.(false);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [videoId, enableResume]);

  // Track NATIVE fullscreen state (standard + webkit) so the control stays in sync
  // and an OS-level exit (swipe/back) restores our layout.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(isNativeFullscreenActive());
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // While in the in-app immersive fallback, lock body scroll (minimal + reversible).
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersive]);

  // Filling the screen = native fullscreen OR the in-app immersive fallback.
  const filling = isFullscreen || immersive;

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    // Exit path.
    if (isNativeFullscreenActive()) {
      exitNativeFullscreen();
      return;
    }
    if (immersive) {
      setImmersive(false);
      return;
    }
    // Enter path — initiated synchronously (gesture preserved). Native when the
    // platform supports it; otherwise the in-app immersive fallback activates.
    void enterFullscreen(el, () => setImmersive(true));
  };

  return (
    <div
      ref={containerRef}
      className={
        "overflow-hidden bg-black " +
        (filling
          ? "fixed inset-0 z-[60] flex items-center justify-center"
          : "relative w-full rounded-xl")
      }
      style={
        filling
          ? { width: "100vw", height: "100dvh" }
          : { aspectRatio: "16 / 9" }
      }
      data-immersive={immersive ? "true" : undefined}
    >
      {/* The player mount fills its box; YouTube letterboxes the video internally,
          so a portrait viewport still shows the video correctly. Never remounted
          on a fullscreen transition — playback is preserved. */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={filling ? "Exit fullscreen" : "Enter fullscreen"}
        className="absolute z-[61] rounded-lg bg-black/45 px-2.5 py-1.5 text-white/90 backdrop-blur-sm transition-opacity hover:bg-black/60"
        style={{
          top: filling ? "max(0.75rem, env(safe-area-inset-top))" : "0.5rem",
          right: filling ? "max(0.75rem, env(safe-area-inset-right))" : "0.5rem",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {filling ? (
            <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
