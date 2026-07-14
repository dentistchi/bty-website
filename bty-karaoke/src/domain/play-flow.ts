// Pure model for the DJ "▶ Play on TV" one-tap flow. No I/O, no DB, no DOM.
// The UI renders from these decisions and wires the concrete effects (window.open
// + the play mutation); this module owns the ordering and target rules.

import type { RequestStatus } from './queue';

export interface StageEntry {
  id: string;
  status: RequestStatus;
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
  /** Open the YouTube video. MUST be called synchronously inside the user
   *  gesture so iPad Safari / standalone PWA does not block the popup. */
  openVideo: () => void;
  /** Transition the request to `playing` on the server. */
  play: () => Promise<unknown> | unknown;
}

/**
 * Run the one-tap play flow in the ONLY safe order:
 *   A. open YouTube first, synchronously, inside the tap gesture (popup-safe)
 *   B. only then run the play mutation
 *
 * `openVideo` is invoked before the first `await`, so a caller that calls this
 * directly from an onClick keeps the window.open inside the user gesture. If the
 * mutation rejects, the error propagates to the caller (the song stays waiting so
 * the DJ can retry) — the video has already opened either way. Callers guard
 * re-entry so repeated taps never fire the mutation twice.
 */
export async function runPlayOnTv(effects: PlayOnTvEffects): Promise<void> {
  effects.openVideo(); // A — must be first, in-gesture, before any await
  await effects.play(); // B — after the window is opened
}
