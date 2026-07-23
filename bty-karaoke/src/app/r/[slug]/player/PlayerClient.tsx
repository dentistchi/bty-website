'use client';

// The ONE same-origin player surface. It creates a single YT.Player and only ever calls
// loadVideoById on it — it never spawns tabs and never mutates lifecycle state. Two inputs
// drive it, in priority order:
//   1. BroadcastChannel push from the Admin (instant) — a validated play command;
//   2. canonical polling of /api/rooms/{slug}/display (recovery) — the DB's playing request
//      is the authority, so a dropped message or a Player refresh re-syncs within one poll.
// localStorage is never an authority. A video that cannot be embedded shows an explicit
// "Open on YouTube" link; that link never triggers a lifecycle Start/pass-turn. The YT
// 'ended' event is ignored — only the Admin's explicit Next Song / Event End changes state.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  playerChannelName,
  isPlayerPlayCommand,
} from '@/domain/player-channel';
import { isValidVideoId, safeYoutubeWatchUrl } from '@/domain/youtube';

interface Props {
  slug: string;
  roomName: string;
  eventId: string | null;
  initialVideoId: string | null;
}

const POLL_MS = 3000;

// Minimal YouTube IFrame API surface we use — kept local so we don't pull a global d.ts.
interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number; CUED: number; UNSTARTED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

export default function PlayerClient({ slug, roomName, eventId, initialVideoId }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const loadedRef = useRef<string | null>(null); // the videoId currently loaded (dedupe)
  const eventRef = useRef<string | null>(eventId); // updated as the canonical event rotates
  const pendingRef = useRef<string | null>(initialVideoId); // set before the player is ready

  const [ready, setReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [unplayable, setUnplayable] = useState<string | null>(null); // videoId that won't embed
  const [nowVideoId, setNowVideoId] = useState<string | null>(initialVideoId);

  // Load a validated video into the single player instance (or stash it until ready). Skips
  // a redundant reload of the same id so playback isn't interrupted by the recovery poll.
  const loadVideo = useCallback((videoId: string | null) => {
    if (!videoId || !isValidVideoId(videoId)) return;
    if (loadedRef.current === videoId) return;
    loadedRef.current = videoId;
    setNowVideoId(videoId);
    setUnplayable(null);
    const player = playerRef.current;
    if (!player) {
      pendingRef.current = videoId; // player not ready yet — apply on onReady
      return;
    }
    try {
      player.loadVideoById(videoId);
    } catch {
      /* transient — the next poll will retry */
    }
  }, []);

  // Create the ONE YT.Player once the IFrame API is available.
  useEffect(() => {
    let cancelled = false;
    const create = () => {
      if (cancelled || playerRef.current || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId: pendingRef.current ?? undefined,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            // Apply whatever the latest desired video is (initial or one that arrived early).
            const want = loadedRef.current ?? pendingRef.current;
            if (want) {
              loadedRef.current = want;
              try {
                playerRef.current?.loadVideoById(want);
              } catch {
                /* ignore */
              }
            }
          },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (S && e.data === S.PLAYING) setNeedsGesture(false);
            // Autoplay blocked leaves it CUED/UNSTARTED — offer a manual gesture control.
            if (S && (e.data === S.CUED || e.data === S.UNSTARTED)) setNeedsGesture(true);
            // ENDED is intentionally ignored: only the Admin's explicit Next Song / Event
            // End changes lifecycle state. The Player never completes a request.
          },
          onError: (e) => {
            // 101 / 150 = embedding disabled by the uploader; 100 = removed/private.
            if (e.data === 101 || e.data === 150 || e.data === 100) {
              setUnplayable(loadedRef.current);
            }
            // 2 (bad param) can't occur — ids are validated before load. 5 (HTML5) is transient.
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      create();
    } else {
      // Register the global callback and inject the API script once.
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        create();
      };
      if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
        const tag = document.createElement('script');
        tag.src = IFRAME_API_SRC;
        document.body.appendChild(tag);
      }
    }
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, []);

  // INSTANT path: validated play commands pushed from the Admin over the room channel.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(playerChannelName(slug));
    ch.onmessage = (ev) => {
      const msg = ev.data;
      if (!isPlayerPlayCommand(msg)) return; // strict validation — ignore anything else
      // Ignore a command scoped to a different event (stale tab from a previous event).
      if (eventRef.current && msg.eventId && msg.eventId !== eventRef.current) return;
      loadVideo(msg.videoId);
    };
    return () => ch.close();
  }, [slug, loadVideo]);

  // RECOVERY path: poll the canonical public display state. The DB's playing request is the
  // authority; this re-syncs the player after a dropped message or a refresh, and tracks the
  // canonical event id so post-rotation commands are accepted.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}/display`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          playing?: { videoId?: string | null } | null;
          event?: { id?: string | null } | null;
        };
        if (stop) return;
        if (data.event?.id) eventRef.current = data.event.id;
        const canonical = data.playing?.videoId ?? null;
        if (canonical && isValidVideoId(canonical)) loadVideo(canonical);
      } catch {
        /* offline blip — the next tick retries */
      }
    };
    void poll();
    const iv = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, loadVideo]);

  const manualPlay = () => {
    try {
      playerRef.current?.playVideo();
      setNeedsGesture(false);
    } catch {
      /* ignore */
    }
  };

  const fallbackUrl = unplayable ? safeYoutubeWatchUrl(unplayable) : null;

  return (
    <main className="player-stage">
      <header className="player-head">
        <span className="player-room">{roomName}</span>
        <span className="player-tag">BTY Player</span>
      </header>

      <div className="player-frame-wrap">
        {/* The IFrame API replaces this node with the <iframe> it manages. */}
        <div ref={mountRef} className="player-frame" />

        {!ready && <div className="player-note">플레이어를 불러오는 중…</div>}

        {ready && !nowVideoId && (
          <div className="player-note">다음 곡을 기다리는 중이에요.</div>
        )}

        {needsGesture && nowVideoId && !fallbackUrl && (
          <button type="button" className="primary lg player-gesture" onClick={manualPlay}>
            ▶ 재생
          </button>
        )}

        {fallbackUrl && (
          <div className="player-fallback" role="alert">
            <span className="muted">이 영상은 여기에서 재생할 수 없어요.</span>
            {/* Opens YouTube directly — a plain link. It NEVER starts or advances a song. */}
            <a className="primary lg" href={fallbackUrl} target="_blank" rel="noreferrer">
              ▶ YouTube에서 열기
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
