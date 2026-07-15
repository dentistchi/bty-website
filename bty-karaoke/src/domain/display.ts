// Shared (client + server) types for the public room display / full-queue read
// model. No I/O. Kept out of *.server.ts so client components can import the
// types without pulling in the service-role client.
//
// V3.1: the iPad Display is NOT a video player (many karaoke uploads block
// external embedding → "Video unavailable"), so there is no embed-URL helper
// here. The Display shows only QR + NOW SINGING + NEXT; the video and lyrics
// live on the TV via the singer's YouTube handoff.

import type { VideoKind } from './video-kind';
import { computeEventStats, type StatRequest } from './event-stats';

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

/**
 * At-a-glance LIVE counts for the Display panel — information only, no secrets.
 * Reuses the same canonical counter (`computeEventStats`) the DJ header and the
 * manager list use, so every surface agrees on the numbers.
 */
export interface DisplayStats {
  /** Distinct singers tonight (case-insensitive names). */
  singers: number;
  /** Every request made tonight, any status. */
  requests: number;
  /** Songs that finished. */
  completed: number;
  /** Songs still waiting in line. */
  waiting: number;
}

export interface DisplayState {
  room: { name: string; slug: string; open: boolean };
  playing: DisplayRequest | null;
  next: DisplayRequest | null;
  waiting: DisplayRequest[];
  waitingCount: number;
  stats: DisplayStats;
}

/**
 * Map the shared event-stat set to the Display LIVE panel. Pure — the server
 * hands in the room's request rows (guest_name + status). No new counting logic.
 */
export function displayStatsFrom(rows: readonly StatRequest[]): DisplayStats {
  const s = computeEventStats(rows);
  return { singers: s.uniqueGuests, requests: s.totalRequests, completed: s.completed, waiting: s.waiting };
}
