"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Swipe-left to reveal a tray of actions (Slice T2.1b).
 *
 * A CONVENIENCE, NEVER THE ONLY PATH. Whatever this reveals must also exist as a visible control
 * in the row itself. A first-time user who never discovers the gesture must be able to do
 * everything, so nothing here is load-bearing.
 *
 * REVEAL, DO NOT COMMIT. Crossing a distance opens the tray; it never performs the action. The
 * person still taps Soon or Later, which is what keeps an accidental drag from making a decision.
 * This is the Apple Mail / Reminders shape, not card dismissal — the row moves aside and comes
 * back, and nothing ever flies away.
 *
 * ONE DIRECTION, TWO EXPLICIT CHOICES. Left reveals; right does nothing. Mapping a meaning to each
 * direction hides the vocabulary behind a gesture that must be learned, and this product has
 * exactly two decisions that are better read than remembered.
 *
 * MODELLED ON the measured `SwipeDraftRow` in FoundryEventRooms (touch handlers, translate clamp,
 * parent-owned open row, no gesture library) and ADDS the two things that pattern lacks: an axis
 * intent lock and a `touchcancel` reset. Foundry is deliberately NOT refactored onto this in the
 * same slice — its row is a one-button drawer with its own device-proven behaviour and its own
 * tests, and changing it here would risk an unrelated surface for no gain. It is the obvious
 * second adopter once this is device-proven.
 *
 * WEB-SIDE ONLY. No native recognizer, no Capacitor gesture plugin, no window-level listener. A
 * window-level `UILongPressGestureRecognizer` once competed with WKWebView's own tap/pan
 * recognizers and produced a global input lock; nothing here can repeat that.
 */

/** Movement before we decide what the finger meant. Below this, the row does not move at all. */
const INTENT_PX = 8;
/** Fallback reveal width when the tray has not been measured yet (jsdom, or first paint). */
const FALLBACK_REVEAL_PX = 176;

export default function SwipeReveal({
  enabled,
  isOpen,
  onOpen,
  onClose,
  actions,
  children,
}: {
  /** False for rows with nothing to reveal — a decided row, or a collapsed conversation group. */
  enabled: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const trayRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  /** null = undecided, "h" = horizontal swipe owns it, "v" = the page's scroll owns it. */
  const axis = useRef<"h" | "v" | null>(null);
  const [dx, setDx] = useState<number | null>(null);
  const [reveal, setReveal] = useState(FALLBACK_REVEAL_PX);

  // The drawer is as wide as the controls actually are — an invented width either clips a label or
  // opens a gap. offsetWidth is 0 under jsdom, so the fallback stands in there.
  useEffect(() => {
    const w = trayRef.current?.offsetWidth ?? 0;
    if (w > 0) setReveal(w);
  }, [actions]);

  const reset = useCallback(() => {
    start.current = null;
    axis.current = null;
    setDx(null);
  }, []);

  // A row that becomes non-swipeable mid-gesture (it was just triaged) must not keep a translation.
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

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
        // WKWebView's scrolling. An open row gets out of the way as scrolling begins.
        setDx(null);
        if (isOpen) onClose();
        return;
      }
    }
    if (axis.current !== "h") return;

    // Left only, clamped to the tray. Rightward drag on a closed row goes nowhere.
    const base = isOpen ? -reveal : 0;
    setDx(Math.min(0, Math.max(base + totalX, -reveal)));
  };

  const onTouchEnd = () => {
    const wasHorizontal = axis.current === "h";
    const moved = dx;
    reset();
    if (!wasHorizontal || moved === null) return;
    // Past halfway it stays open; short of that it settles back. Opening never decides anything.
    if (moved < -reveal / 2) onOpen();
    else onClose();
  };

  /** A cancelled touch (a call, a system gesture) must not strand the row mid-translate. */
  const onTouchCancel = () => reset();

  const translate = dx !== null ? dx : isOpen ? -reveal : 0;

  if (!enabled) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-xl" data-testid="swipe-row" data-open={isOpen ? "true" : "false"}>
      {/* The tray sits behind the row and is only reachable once revealed, so its buttons are not
          in the tab order while hidden — the visible in-card controls are the keyboard path. */}
      <div
        ref={trayRef}
        aria-hidden={!isOpen}
        className="absolute inset-y-0 right-0 flex items-stretch"
        data-testid="swipe-actions"
      >
        {actions}
      </div>
      <div
        data-testid="swipe-surface"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        // Tapping the row while it is open puts it away — the same expectation as Mail.
        onClick={() => {
          if (isOpen && dx === null) onClose();
        }}
        style={{ transform: `translateX(${translate}px)` }}
        // Short and quiet, and only while settling — a transition during the drag would lag the
        // finger. `motion-reduce` drops it entirely, matching the app's existing handling.
        className={`relative ${dx === null ? "transition-transform duration-150 ease-out motion-reduce:transition-none" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
