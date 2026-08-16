// Shared (client + server) types for the public room display / full-queue read
// model. No I/O. Kept out of *.server.ts so client components can import the
// types without pulling in the service-role client.
//
// V3.1: the iPad Display is NOT a video player (many karaoke uploads block
// external embedding → "Video unavailable"), so there is no embed-URL helper
// here. The Display shows only QR + NOW SINGING + NEXT; the video and lyrics
// live on the TV via the singer's YouTube handoff.

import type { VideoKind } from './video-kind';
import type { LyricsView } from './lyrics';
import { computeEventStats, type StatRequest } from './event-stats';

export interface DisplayRequest {
  id: string;
  guestName: string;
  /** Raw-ish label (youtube title / search query) — kept for the guest queue board. */
  title: string;
  artist: string | null;
  /** V1.3: normalized human-first song title (karaoke/MR/official suffixes removed). */
  songTitle: string;
  /** V1.3: normalized artist (from a "Song - Artist" split or the channel), or null. */
  songArtist: string | null;
  /** NULL once a retention transition cleared it (R6). */
  videoId: string | null;
  videoKind: VideoKind;
  thumbnailUrl: string | null;
  status: 'playing' | 'waiting';
  /** V6: this waiting singer signalled Ready (Display can show "NEXT · READY"). */
  ready: boolean;
  /**
   * Lyrics V1: the current song's lyrics view. Populated ONLY for the `playing`
   * request (the Display shows lyrics for the song on stage) — omitted on waiting
   * rows to keep the polled payload small. Because lyrics ride inside this same
   * display poll (no separate fetch), they can never be stale relative to NOW
   * SINGING: a song change swaps the whole `playing` object atomically.
   */
  lyrics?: LyricsView;
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

/**
 * The room's ONE canonical event identity (V5), or null for a legacy room that no
 * event owns. Every screen carries the same `id` so Admin / DJ / Display / Guest
 * are provably in the same group. `status` lets each screen show an honest ended
 * state. Populated at the service/route boundary (which knows events); the domain
 * projection stays event-agnostic.
 */
export interface DisplayEventInfo {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'ended' | 'archived';
}

export interface DisplayState {
  room: { name: string; slug: string; open: boolean };
  playing: DisplayRequest | null;
  next: DisplayRequest | null;
  waiting: DisplayRequest[];
  waitingCount: number;
  stats: DisplayStats;
  /** The room's single canonical event, or null (legacy/self-service room). */
  event: DisplayEventInfo | null;
}

/**
 * Map the shared event-stat set to the Display LIVE panel. Pure — the server
 * hands in the room's request rows (guest_name + status). No new counting logic.
 */
export function displayStatsFrom(rows: readonly StatRequest[]): DisplayStats {
  const s = computeEventStats(rows);
  return { singers: s.uniqueGuests, requests: s.totalRequests, completed: s.completed, waiting: s.waiting };
}
