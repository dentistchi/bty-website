"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Swipe a row to make its decision — left commits one choice, right commits the other.
 *
 * WHAT CHANGED AND WHY (Founder review, 2026-09-02). This used to REVEAL a tray holding the same
 * two buttons the card already showed. That was a longer road to the same place: swipe, wait for
 * the tray, then tap one of a second, identical pair — and it left the card parked open until
 * something closed it. The gesture now IS the decision, and the card's own buttons remain the
 * discoverable, keyboard-reachable path for anyone who never learns it.
 *
 * DIRECTION IS THE VOCABULARY, and it matches where the buttons already sit: left is the left
 * choice, right is the right choice. Nothing has to be remembered that the card does not show.
 *
 * ONLY ONE OUTCOME IS EVER ON SCREEN. Dragging left renders the left outcome and nothing else;
 * dragging right renders the right outcome and nothing else. A person can never be looking at two
 * possible results of one gesture.
 *
 * ★ AT REST THIS COMPONENT RENDERS NO ACTION SURFACE AT ALL — not a hidden one, not a transparent
 * one, none. The previous shape kept a tray mounted behind every row and relied on the card
 * painting over it, which failed on a card that is `bg-white/[0.02]`: the tray read straight
 * through it as a translucent strip. That is now structurally impossible rather than merely
 * fixed — there is nothing behind a resting row to leak.
 *
 * COMMITTING IS DELIBERATE. An 8px axis lock keeps ordinary vertical scrolling out of this
 * entirely, and the commit distance is far past the point of an accidental brush. Below it the row
 * settles back and NOTHING happens. There is no undo here because there is nothing to undo: the
 * two choices are both "later", and the card is still on screen in its new group.
 *
 * WEB-SIDE ONLY. No native recognizer, no gesture library, no window-level listener — the same
 * constraint the previous implementation carried, for the same reason.
 */

/** Movement before we decide what the finger meant. Below this, the row does not move at all. */
const INTENT_PX = 8;
/** How far a row must travel before releasing it decides anything. Deliberately past a brush. */
const COMMIT_PX = 96;
/** The row never leaves its lane: travel is clamped a little past the commit point. */
const MAX_PX = 132;

export type SwipeOutcome = {
  /** The word shown behind the row while it is being dragged toward this outcome. */
  label: string;
  /** The CANONICAL handler — the identical one the card's own visible button calls. */
  onCommit: () => void;
  /** Reuses the tone the card already gives this choice. No new colour is introduced here. */
  className: string;
};

export default function SwipeAction({
  enabled,
  left,
  right,
  children,
}: {
  /** False for rows with nothing to decide — a decided row, or a collapsed conversation group. */
  enabled: boolean;
  /** Swipe LEFT commits this. */
  left: SwipeOutcome;
  /** Swipe RIGHT commits this. */
  right: SwipeOutcome;
  children: React.ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  /** null = undecided, "h" = horizontal swipe owns it, "v" = the page's scroll owns it. */
  const axis = useRef<"h" | "v" | null>(null);
  const [dx, setDx] = useState<number | null>(null);

  const reset = useCallback(() => {
    start.current = null;
    axis.current = null;
    setDx(null);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
    axis.current = null;
    setDx(null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = start.current;
    const t = e.touches[0];
    if (!enabled || !s || !t) return;

    const totalX = t.clientX - s.x;
    const totalY = t.clientY - s.y;

    if (axis.current === null) {
      // Not enough movement to mean anything yet: hold still rather than guess.
      if (Math.abs(totalX) < INTENT_PX && Math.abs(totalY) < INTENT_PX) return;
      axis.current = Math.abs(totalX) > Math.abs(totalY) ? "h" : "v";
      if (axis.current === "v") {
        // The page owns this gesture. Never preventDefault here — that is what would fight
        // WKWebView's scrolling, and Teams on iOS is a WKWebView.
        setDx(null);
        return;
      }
    }
    if (axis.current !== "h") return;

    setDx(Math.max(-MAX_PX, Math.min(MAX_PX, totalX)));
  };

  /**
   * Release decides. Past the commit distance in either direction calls that side's canonical
   * handler EXACTLY ONCE; short of it, nothing is called at all.
   *
   * `reset()` runs FIRST, so the row is already on its way home before the handler runs. Whatever
   * the decision does — succeed, fail and roll back, re-group the card — it can never find a
   * stranded translation or a leftover open state waiting for it, because none exists by then.
   */
  const onTouchEnd = () => {
    const moved = dx;
    const wasHorizontal = axis.current === "h";
    reset();
    if (!enabled || !wasHorizontal || moved === null) return;
    if (moved <= -COMMIT_PX) left.onCommit();
    else if (moved >= COMMIT_PX) right.onCommit();
  };

  /** A cancelled touch (a call, a system gesture) decides nothing and strands nothing. */
  const onTouchCancel = () => reset();

  if (!enabled) return <>{children}</>;

  const translate = dx ?? 0;
  // Which outcome this drag is heading toward — and therefore the ONLY one that may be on screen.
  const heading = translate < 0 ? left : translate > 0 ? right : null;
  const armed = Math.abs(translate) >= COMMIT_PX;

  return (
    <div className="relative overflow-hidden rounded-xl" data-testid="swipe-row">
      {/* Rendered ONLY while the row is actually travelling. At rest this is not in the DOM. */}
      {heading ? (
        <div
          aria-hidden
          data-testid="swipe-indicator"
          data-direction={translate < 0 ? "left" : "right"}
          data-outcome={heading.label}
          data-armed={armed ? "true" : "false"}
          className={
            "pointer-events-none absolute inset-y-0 z-0 flex items-center px-4 text-[0.85rem] font-medium " +
            // The row uncovers the side it is moving away from, so the outcome sits there.
            (translate < 0 ? "right-0 justify-end " : "left-0 justify-start ") +
            heading.className +
            // Past the commit point it reads as certain; before it, as a hint.
            (armed ? " opacity-100" : " opacity-60")
          }
          style={{ width: MAX_PX }}
        >
          {heading.label}
        </div>
      ) : null}
      <div
        data-testid="swipe-surface"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        style={{ transform: `translateX(${translate}px)` }}
        // Short and quiet, and only while settling — a transition during the drag would lag the
        // finger. `motion-reduce` drops it entirely, matching the app's existing handling.
        className={`relative z-10 ${dx === null ? "transition-transform duration-150 ease-out motion-reduce:transition-none" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
