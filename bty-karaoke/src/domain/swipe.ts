// Pure swipe-gesture math shared by the request (right-swipe) and cancel
// (left-swipe) cards. No DOM — components feed in deltas and read decisions.
// This keeps threshold/direction/scroll-guard logic testable.
//
// The intent model is a DEAD-ZONE-then-DECIDE machine: while the finger is
// inside the slop zone we stay `pending` (never abandon), and only once it
// leaves the slop do we commit to `horizontal` (ours) or `vertical` (let the
// page scroll). The earlier code abandoned on the first noisy sample where
// dy>dx, which killed real touch swipes on iPhone.

export type SwipeDirection = 'left' | 'right';
export type SwipeIntent = 'pending' | 'horizontal' | 'vertical';

/** Below this movement in BOTH axes the gesture is undecided (dead zone). */
export const HORIZONTAL_SLOP = 12; // px
/** Horizontal must beat vertical by this ratio to claim the gesture. */
export const INTENT_RATIO = 1.2;
/** Fallback commit distance when a card width isn't available. */
export const DEFAULT_SWIPE_THRESHOLD = 96; // px

/** Clamp a raw delta to the card's allowed swipe direction (other way → 0). */
export function clampToDirection(dx: number, direction: SwipeDirection): number {
  if (direction === 'right') return dx > 0 ? dx : 0;
  return dx < 0 ? dx : 0;
}

/**
 * Decide gesture intent from the running delta. Stays `pending` inside the slop
 * zone (so a real finger's noisy start is never mis-abandoned). Once past the
 * slop: `horizontal` only if it beats vertical by INTENT_RATIO AND moves in the
 * card's allowed direction; otherwise `vertical` (page scroll wins).
 */
export function decideIntent(
  dx: number,
  dy: number,
  direction: SwipeDirection,
  slop = HORIZONTAL_SLOP,
  ratio = INTENT_RATIO,
): SwipeIntent {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < slop && ady < slop) return 'pending';
  if (adx >= slop && adx > ady * ratio && clampToDirection(dx, direction) !== 0) return 'horizontal';
  return 'vertical';
}

/** @deprecated kept for callers that only need a boolean; prefer decideIntent. */
export function isHorizontalIntent(dx: number, dy: number, slop = HORIZONTAL_SLOP): boolean {
  return Math.abs(dx) > Math.abs(dy) * INTENT_RATIO && Math.abs(dx) >= slop;
}

/** Deliberate commit distance: a fraction of the card width, clamped. */
export function commitThresholdPx(cardWidth: number, fraction = 0.35, min = 64, max = 180): number {
  if (!cardWidth || cardWidth <= 0) return DEFAULT_SWIPE_THRESHOLD;
  return Math.min(max, Math.max(min, cardWidth * fraction));
}

/** 0..1 progress toward the commit threshold, for the reveal animation. */
export function swipeProgress(
  dx: number,
  direction: SwipeDirection,
  threshold = DEFAULT_SWIPE_THRESHOLD,
): number {
  const d = Math.abs(clampToDirection(dx, direction));
  return Math.max(0, Math.min(1, d / threshold));
}

/**
 * Whether a released swipe should COMMIT. Requires the deliberate threshold in
 * the correct direction. A short or wrong-direction swipe returns false → snap back.
 */
export function swipeCommitted(
  dx: number,
  direction: SwipeDirection,
  threshold = DEFAULT_SWIPE_THRESHOLD,
): boolean {
  return Math.abs(clampToDirection(dx, direction)) >= threshold;
}

/** True when a gesture starting this close to a screen edge should be left to the OS (back/forward nav). */
export function isEdgeStart(clientX: number, viewportWidth: number, edge = 24): boolean {
  return clientX <= edge || clientX >= viewportWidth - edge;
}
