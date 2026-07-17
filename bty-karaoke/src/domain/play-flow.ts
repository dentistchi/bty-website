// Pure model for the DJ "▶ Play on TV" one-tap flow. No I/O, no DB, no DOM.
// The UI renders from these decisions and wires the concrete effects (the play
// mutation + same-window navigation); this module owns the ordering and target
// rules.

import { canonicalRank, type RequestStatus, type QueueOrderEntry } from './queue';

export interface StageEntry {
  id: string;
  status: RequestStatus;
}

/** A request as far as the stage decision cares: order keys + the Ready signal. */
export interface ReadyStageEntry extends QueueOrderEntry {
  ready_at: string | null;
}

/**
 * The pure decision behind V8.1 auto-promotion. Given the active requests, decide
 * what the stage should do — with NO I/O. The one rule that fixes the "unready
 * blocks everyone" bug: among WAITING songs, the promote target is the earliest
 * *Ready* one; an un-ready song NEVER blocks a Ready song behind it.
 *
 *   • busy       — a song is already playing (never interrupt it)
 *   • promote    — the earliest-position Ready waiting song should start now
 *   • none_ready — songs are waiting but NONE is Ready yet (nothing to start)
 *   • empty      — no waiting songs at all
 */
export type StageDecision<T> =
  | { kind: 'busy'; playing: T }
  | { kind: 'promote'; request: T }
  | { kind: 'none_ready'; firstWaiting: T }
  | { kind: 'empty' };

export function resolveStageDecision<T extends ReadyStageEntry>(
  active: readonly T[],
): StageDecision<T> {
  const playing = active.find((r) => r.status === 'playing');
  if (playing) return { kind: 'busy', playing };
  const waiting = active.filter((r) => r.status === 'waiting').slice().sort(canonicalRank);
  if (waiting.length === 0) return { kind: 'empty' };
  const ready = waiting.find((r) => r.ready_at != null);
  return ready ? { kind: 'promote', request: ready } : { kind: 'none_ready', firstWaiting: waiting[0] };
}

/**
 * The single waiting song the strongest "▶ Play on TV" primary should target,
 * or null when there is none to play.
 *
 * Rule: the play primary exists ONLY while the stage is open — i.e. nothing is
 * marked `playing`. When a song is on stage the DJ must finish it first; we never
 * auto-swap the stage or run two songs at once. When the stage is open, the
 * target is the FIRST waiting song. Any other waiting song is reached by first
 * moving it to the front (먼저 부르기), never a second parallel play.
 */
export function primaryPlayTarget<T extends StageEntry>(
  current: T | null,
  queue: readonly T[],
): T | null {
  if (current) return null;
  return queue[0] ?? null;
}

export interface PlayOnTvEffects {
  /** Transition the request to `playing` on the server. Awaited FIRST so the
   *  state is committed while the page is still alive. */
  play: () => Promise<unknown> | unknown;
  /** Navigate THIS browsing context to the YouTube video (e.g. location.assign).
   *  Runs LAST, only after the mutation resolves. Reusing the current window —
   *  never window.open / a new tab — means iPad Safari hands off to the YouTube
   *  app without leaving a blank Safari window behind, and same-window navigation
   *  has no popup blocker to dodge. */
  openVideo: () => void;
}

/**
 * Run the one-tap play flow in the ONLY safe order for same-window navigation:
 *   B. run the play mutation and AWAIT it (commit waiting→playing)
 *   A. only then navigate the current window to YouTube
 *
 * Navigation is deferred to the end because navigating the current browsing
 * context unloads this page and would abort an in-flight play fetch — so the
 * mutation must finish first. If the mutation rejects, the error propagates and
 * navigation is skipped (the song stays waiting; the DJ sees the error and
 * retries — we never send them to YouTube for a song that never started).
 * Callers guard re-entry so repeated taps never fire the mutation twice.
 */
export async function runPlayOnTv(effects: PlayOnTvEffects): Promise<void> {
  await effects.play(); // B — commit the state while the page is still alive
  effects.openVideo(); // A — then navigate this window (no blank window)
}

export interface OpenOnDeviceEffects {
  /** Navigate THIS window to the YouTube video (same-window, no blank tab). */
  openVideo: () => void;
}

/**
 * "Open on this iPad" — a PERSONAL-SCREEN open, NOT a playback transition. It ONLY
 * navigates to the video; it deliberately has NO `play` effect, so it can never
 * move a request to `playing`, create a second playing row, finish a song, or
 * touch any state. Only runPlayOnTv performs the playing transition. Same-window
 * navigation preserves the no-blank-window behavior and pops no blocker.
 */
export function runOpenOnDevice(effects: OpenOnDeviceEffects): void {
  effects.openVideo();
}
