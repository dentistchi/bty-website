"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Swipe a Today card left to reveal Remove, then TAP it.
 *
 * ★ WHY THIS DOES NOT REUSE `SwipeAction`'s COMMIT-ON-RELEASE.
 *
 * `SwipeAction` deliberately made the gesture itself the decision — a Founder review on 2026-09-02
 * removed its reveal tray because it was "a longer road to the same place". That is right for the
 * surface it serves: Saved-for-later's two choices are both "later", the card stays on screen in a
 * new group, and its own comment says "there is no undo here because there is nothing to undo".
 *
 * Remove is not that. It makes a card DISAPPEAR from Today. A gesture that hides something on
 * release would let a decisive scroll-adjacent flick take a card away with nothing to stop it, and
 * the person would have no idea what left. So the reveal is kept here, on purpose, and the tap is
 * the decision. Same measured constants, different contract, for a different stake.
 *
 * ★ WHAT IT BORROWS, BECAUSE THOSE NUMBERS WERE ALREADY EARNED ON A DEVICE.
 *
 *   8px axis lock    below this the row does not move at all, so ordinary vertical scrolling
 *                    never becomes a swipe. `touchAction: "pan-y"` tells the browser the same
 *                    thing, and nothing here ever calls preventDefault — the page keeps its scroll.
 *   96px reveal      far past an accidental brush.
 *   132px clamp      the row never leaves its lane, so the page cannot scroll sideways.
 *
 * ★ ONE OPEN AT A TIME is enforced by the PARENT, which owns `openId`. Two cards cannot be open
 * because there is only one slot to be open in.
 *
 * ★ IT IS NOT THE ONLY PATH. The Remove control is a real focusable button and the parent also
 * renders a visible, keyboard-reachable action; a hidden gesture is never the only way to do a
 * thing (see `NeedsYourResponse`'s own note about hidden gestures).
 */

/** Movement before we decide what the finger meant. Below this the row does not move at all. */
const INTENT_PX = 8;
/** How far the row must travel for the action to latch open on release. */
const REVEAL_PX = 96;
/** The row never leaves its lane. */
const MAX_PX = 132;

export default function SwipeToRemove({
  enabled,
  open,
  onOpenChange,
  onRemove,
  removeLabel,
  busy,
  children,
}: {
  /** False for a card that is not settled — there is nothing to tidy away yet. */
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  removeLabel: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");

  /** Resting offset: latched open sits at the reveal width; otherwise flush. */
  const resting = open ? -REVEAL_PX : 0;
  const translate = Math.max(-MAX_PX, Math.min(0, resting + drag));

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      axis.current = "none";
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !start.current) return;
      const t = e.touches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;

      if (axis.current === "none") {
        if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return;
        // The bigger movement wins ONCE, and the decision is not revisited mid-gesture.
        axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      // A vertical gesture belongs to the page. We never claim it and never preventDefault.
      if (axis.current !== "x") return;
      setDrag(dx);
    },
    [enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled) {
      start.current = null;
      return;
    }
    const moved = resting + drag;
    start.current = null;
    axis.current = "none";
    setDrag(0);
    /*
      A SHORT swipe is enough to REVEAL — half the reveal width latches it open. That is deliberate
      and it is safe precisely because revealing decides nothing: the tap does. Anything less
      settles back and nothing happens at all.
    */
    onOpenChange(moved <= -REVEAL_PX / 2);
  }, [enabled, resting, drag, onOpenChange]);

  /* Tapping anywhere else closes it — the same way an iOS row does. */
  const rowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, onOpenChange]);

  return (
    <div
      ref={rowRef}
      className="relative overflow-hidden rounded-2xl"
      data-testid="swipe-remove-row"
      data-open={open ? "1" : "0"}
      data-enabled={enabled ? "1" : "0"}
    >
      {/*
        ★ NOTHING IS MOUNTED BEHIND A RESTING ROW. A tray kept permanently behind every card reads
        straight through a `bg-white/[0.02]` surface as a translucent strip — a defect this repo has
        already paid for once. There is nothing to leak because there is nothing there.
      */}
      {enabled && (open || translate < 0) ? (
        <div className="absolute inset-y-0 right-0 flex items-stretch" data-testid="swipe-remove-tray">
          <button
            type="button"
            data-testid="swipe-remove-action"
            disabled={busy}
            onClick={onRemove}
            /* 96px wide, full height — comfortably past the 44px thumb target. */
            className="flex w-24 items-center justify-center bg-[#B3261E] px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {removeLabel}
          </button>
        </div>
      ) : null}

      <div
        data-testid="swipe-remove-surface"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${translate}px)`,
          transition: start.current ? "none" : "transform 160ms ease-out",
          // The browser keeps vertical panning. This is what stops the gesture fighting the page.
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
