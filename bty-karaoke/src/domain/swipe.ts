// Pure swipe-gesture math shared by the request (right-swipe) and cancel
// (left-swipe) cards. No DOM — components feed in deltas and read decisions.
// This keeps threshold/direction/scroll-guard logic testable.

export type SwipeDirection = 'left' | 'right';

/** Commit distance: a deliberate drag, not a stray touch. */
export const DEFAULT_SWIPE_THRESHOLD = 96; // px
/** Below this the gesture is treated as a tap/scroll, not a swipe. */
export const HORIZONTAL_SLOP = 12; // px

/**
 * True when a mostly-horizontal intent is detected — lets the card claim the
 * gesture only when the finger clearly moves sideways, so vertical scrolling
 * keeps working.
 */
export function isHorizontalIntent(dx: number, dy: number, slop = HORIZONTAL_SLOP): boolean {
  return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= slop;
}

/** Clamp a raw delta to the card's allowed swipe direction (other way → 0). */
export function clampToDirection(dx: number, direction: SwipeDirection): number {
  if (direction === 'right') return dx > 0 ? dx : 0;
  return dx < 0 ? dx : 0;
}

/** 0..1 progress toward the commit threshold, for the reveal animation. */
export function swipeProgress(dx: number, direction: SwipeDirection, threshold = DEFAULT_SWIPE_THRESHOLD): number {
  const d = Math.abs(clampToDirection(dx, direction));
  return Math.max(0, Math.min(1, d / threshold));
}

/**
 * Whether a released swipe should COMMIT the action. Requires the deliberate
 * threshold in the correct direction. A short or wrong-direction swipe returns
 * false → the card snaps back.
 */
export function swipeCommitted(
  dx: number,
  direction: SwipeDirection,
  threshold = DEFAULT_SWIPE_THRESHOLD,
): boolean {
  return Math.abs(clampToDirection(dx, direction)) >= threshold;
}
