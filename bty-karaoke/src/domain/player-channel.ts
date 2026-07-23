// Pure contract for the Admin → BTY Player same-origin channel. No I/O, no DOM.
// Both the Admin (DjConsole, sender) and the Player (PlayerClient, receiver) import this so
// the channel name, message shape, and validation are defined exactly once.

import { isValidVideoId } from './youtube';

/** The single message discriminator carried over the BroadcastChannel. */
export const PLAYER_COMMAND_TYPE = 'bty-player-command' as const;

/**
 * Room-scoped names. The BroadcastChannel and the window.open target share the same stable,
 * per-Room string so there is exactly ONE Player tab and ONE channel per Room. Same-origin,
 * so (unlike the youtube.com popup) the named browsing context reliably reuses.
 */
export function playerChannelName(slug: string): string {
  return `bty-norebang-player-${slug}`;
}
export function playerWindowName(slug: string): string {
  return `bty-norebang-player-${slug}`;
}

/** Same-origin path of the Player tab for a room. */
export function playerHref(slug: string): string {
  return `/r/${encodeURIComponent(slug)}/player`;
}

/** A "play this video" command. `videoId` is always a validated 11-char id. */
export interface PlayerPlayCommand {
  type: typeof PLAYER_COMMAND_TYPE;
  command: 'play';
  videoId: string;
  requestId: string;
  /** The event the command belongs to — the Player ignores stale cross-event commands. */
  eventId: string | null;
}

/** Build a validated play command, or null when the video id is not a canonical 11-char id. */
export function buildPlayCommand(
  videoId: string,
  requestId: string,
  eventId: string | null,
): PlayerPlayCommand | null {
  if (!isValidVideoId(videoId)) return null;
  return { type: PLAYER_COMMAND_TYPE, command: 'play', videoId, requestId, eventId };
}

/**
 * Strict type guard for an incoming message. Rejects anything that is not a well-formed play
 * command with a canonical video id — the Player must never act on unvalidated input.
 */
export function isPlayerPlayCommand(msg: unknown): msg is PlayerPlayCommand {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === PLAYER_COMMAND_TYPE &&
    m.command === 'play' &&
    typeof m.videoId === 'string' &&
    isValidVideoId(m.videoId) &&
    typeof m.requestId === 'string' &&
    (m.eventId === null || typeof m.eventId === 'string')
  );
}
