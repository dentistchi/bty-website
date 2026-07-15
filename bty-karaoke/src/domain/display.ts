// Shared (client + server) types for the public room display / full-queue read
// model. No I/O. Kept out of *.server.ts so client components can import the
// types without pulling in the service-role client.
//
// V3.1: the iPad Display is NOT a video player (many karaoke uploads block
// external embedding → "Video unavailable"), so there is no embed-URL helper
// here. The Display shows only QR + NOW SINGING + NEXT; the video and lyrics
// live on the TV via the singer's YouTube handoff.

import type { VideoKind } from './video-kind';

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
