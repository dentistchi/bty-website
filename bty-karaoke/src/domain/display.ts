// Shared (client + server) types for the public room display / full-queue read
// model, plus the pure helper that builds a SAFE muted embed URL for the iPad.
// No I/O. Kept out of *.server.ts so client components can import the types
// without pulling in the service-role client.

import type { VideoKind } from './video-kind';
import { isValidVideoId } from './youtube';

export interface DisplayRequest {
  id: string;
  guestName: string;
  title: string;
  artist: string | null;
  videoId: string;
  videoKind: VideoKind;
  thumbnailUrl: string | null;
  status: 'playing' | 'waiting';
}

export interface DisplayState {
  room: { name: string; slug: string; open: boolean };
  playing: DisplayRequest | null;
  next: DisplayRequest | null;
  waiting: DisplayRequest[];
  waitingCount: number;
}

/**
 * A privacy-friendly, muted, inline embed URL for the iPad Display — or null for
 * a malformed id (callers must no-op on null, never render a bare iframe). Uses
 * youtube-nocookie.com and mutes by default (sound lives on the TV, not the
 * iPad). autoplay is requested but the browser may still gate it behind a user
 * gesture; the Display treats the embed as a best-effort reference screen, never
 * a guarantee of playback or lyric sync.
 */
export function displayEmbedUrl(videoId: string | null | undefined): string | null {
  if (!isValidVideoId(videoId)) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    modestbranding: '1',
    rel: '0',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
