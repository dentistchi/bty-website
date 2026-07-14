/**
 * Foundry Watch Integrity Engine — pure domain (Immersive Learning V1).
 *
 * PURPOSE: estimate whether the participant actually EXPERIENCED the training
 * video, so the AI Reflection can speak from real behavioral evidence. This is
 * NOT surveillance, NOT punishment, NOT cheating detection. It never gates XP,
 * never blocks completion, and never persists raw telemetry.
 *
 * The engine is a pure reducer that runs entirely client-side. Raw signals
 * (playback ticks, seeks) are EPHEMERAL — they live in the browser and are
 * discarded when the tab closes. Only the derived `CompletionState` (meaning)
 * ever leaves the client. "BTY remembers meaning, not surveillance."
 *
 * No DB, no I/O, no framework — inputs in, state out.
 */

export type CompletionState = "pass" | "review" | "incomplete";

/** Whole-second granularity for coverage buckets (1s). */
const BUCKET_SECONDS = 1;

/**
 * A forward jump larger than this (seconds) between two consecutive playing
 * ticks is treated as a deliberate forward seek (scrub-ahead), not natural
 * playback drift. Normal ticks advance by the poll interval (~0.5–1s) times
 * playbackRate, so 2s comfortably clears 2× speed.
 */
export const FORWARD_SEEK_THRESHOLD_SECONDS = 2;

/** Coverage at/above this with few forward seeks → the participant experienced it. */
export const WATCH_PASS_COVERAGE = 0.9;
/** Coverage at/above this (but not PASS) → they saw enough to reflect, with skips. */
export const WATCH_REVIEW_COVERAGE = 0.6;
/** More than this many forward seeks demotes an otherwise-PASS watch to REVIEW. */
export const MAX_PASS_FORWARD_SEEKS = 3;

/**
 * Accumulated watch evidence. `watchedBuckets` is a set of whole-second indices
 * actually played through (deduped, so re-watching doesn't inflate coverage).
 * All fields are plain data so the accumulator serializes trivially and the
 * reducer stays pure.
 */
export type WatchAccumulator = {
  durationSeconds: number;
  watchedBuckets: Set<number>;
  lastPositionSeconds: number | null;
  forwardSeekCount: number;
  reachedEnd: boolean;
};

/** The derived, user-safe state. Raw metrics here NEVER reach the user directly. */
export type WatchIntegrity = {
  watchCoverage: number; // 0..1 fraction of unique video seconds played through
  forwardSeekCount: number;
  completionState: CompletionState;
};

export function createWatchAccumulator(durationSeconds = 0): WatchAccumulator {
  return {
    durationSeconds: sanitizeDuration(durationSeconds),
    watchedBuckets: new Set<number>(),
    lastPositionSeconds: null,
    forwardSeekCount: 0,
    reachedEnd: false,
  };
}

function sanitizeDuration(d: unknown): number {
  const n = typeof d === "number" && Number.isFinite(d) ? d : 0;
  return n > 0 ? n : 0;
}

/**
 * Record one playback tick at `positionSeconds` while the video is playing.
 * Marks the current second watched and detects a forward scrub (a jump beyond
 * the threshold). Backward jumps are re-watching, not a skip — they only reset
 * the anchor. Pure: returns a NEW accumulator (the input is not mutated apart
 * from the shared Set, which we copy to keep referential-transparency for tests).
 */
export function recordTick(acc: WatchAccumulator, positionSeconds: number): WatchAccumulator {
  if (typeof positionSeconds !== "number" || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return acc;
  }

  const watched = new Set(acc.watchedBuckets);
  watched.add(Math.floor(positionSeconds / BUCKET_SECONDS));

  let forwardSeekCount = acc.forwardSeekCount;
  if (acc.lastPositionSeconds !== null) {
    const delta = positionSeconds - acc.lastPositionSeconds;
    if (delta > FORWARD_SEEK_THRESHOLD_SECONDS) forwardSeekCount += 1;
  }

  return {
    ...acc,
    watchedBuckets: watched,
    lastPositionSeconds: positionSeconds,
    forwardSeekCount,
  };
}

/** Learn/refine the video duration once the player reports it. */
export function setDuration(acc: WatchAccumulator, durationSeconds: number): WatchAccumulator {
  const d = sanitizeDuration(durationSeconds);
  if (d <= 0 || d === acc.durationSeconds) return acc;
  return { ...acc, durationSeconds: d };
}

/** Mark that the player fired ENDED (natural completion of the timeline). */
export function markReachedEnd(acc: WatchAccumulator): WatchAccumulator {
  if (acc.reachedEnd) return acc;
  return { ...acc, reachedEnd: true };
}

/**
 * Collapse the accumulator into the derived, user-safe state. Coverage is unique
 * watched seconds over duration (capped at 1). When duration is unknown (0) we
 * fall back to `reachedEnd` so a completed-but-unmeasured watch still reads PASS
 * rather than INCOMPLETE — the server already gates completion on the ENDED
 * flag, and this engine must never be MORE punitive than that gate.
 */
export function computeWatchIntegrity(acc: WatchAccumulator): WatchIntegrity {
  const totalBuckets =
    acc.durationSeconds > 0 ? Math.max(1, Math.ceil(acc.durationSeconds / BUCKET_SECONDS)) : 0;

  const watchCoverage =
    totalBuckets > 0
      ? Math.min(1, acc.watchedBuckets.size / totalBuckets)
      : acc.reachedEnd
        ? 1
        : 0;

  const completionState = classifyCompletion(watchCoverage, acc.forwardSeekCount);
  return { watchCoverage, forwardSeekCount: acc.forwardSeekCount, completionState };
}

/** Pure threshold classification — the single place watch "meaning" is decided. */
export function classifyCompletion(watchCoverage: number, forwardSeekCount: number): CompletionState {
  if (watchCoverage >= WATCH_PASS_COVERAGE && forwardSeekCount <= MAX_PASS_FORWARD_SEEKS) {
    return "pass";
  }
  if (watchCoverage >= WATCH_REVIEW_COVERAGE) return "review";
  return "incomplete";
}

/** Narrow an unknown (e.g. client-supplied) value to a valid CompletionState. */
export function parseCompletionState(value: unknown): CompletionState | null {
  return value === "pass" || value === "review" || value === "incomplete" ? value : null;
}

// ---------------------------------------------------------------------------
// Checkpoint reflections (Part 5) — optional, never mandatory.
// ---------------------------------------------------------------------------

/** A single pause-point where an optional reflection prompt may surface. */
export type WatchCheckpoint = {
  atSeconds: number;
  /** Stable 0-based index (for choosing a prompt deterministically). */
  index: number;
};

/** Below this duration a video is too short to interrupt — zero checkpoints. */
export const CHECKPOINT_MIN_DURATION_SECONDS = 6 * 60; // 6 minutes
/** At/above this duration, offer two checkpoints instead of one. */
export const CHECKPOINT_TWO_DURATION_SECONDS = 12 * 60; // 12 minutes

/**
 * Deterministically place 0–2 checkpoints from the video duration. Short videos
 * get none; medium videos get one near the middle; long videos get two at the
 * thirds. Pure and stable so the client fires each checkpoint exactly once.
 */
export function computeCheckpoints(durationSeconds: number): WatchCheckpoint[] {
  const d = sanitizeDuration(durationSeconds);
  if (d < CHECKPOINT_MIN_DURATION_SECONDS) return [];
  if (d < CHECKPOINT_TWO_DURATION_SECONDS) {
    return [{ atSeconds: Math.round(d / 2), index: 0 }];
  }
  return [
    { atSeconds: Math.round(d / 3), index: 0 },
    { atSeconds: Math.round((d * 2) / 3), index: 1 },
  ];
}
