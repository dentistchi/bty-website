'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  decideIntent,
  clampToDirection,
  swipeProgress,
  swipeCommitted,
  commitThresholdPx,
  isEdgeStart,
  type SwipeDirection,
} from '@/domain/swipe';

interface Props {
  /** Which way this card commits. Meaning is carried by tone/icon/label, not direction. */
  direction: SwipeDirection;
  /** Fired once when a deliberate swipe crosses the threshold and is released. */
  onCommit: () => void;
  tone: 'gold' | 'coral';
  icon: string;
  /** Revealed action label, e.g. "신청하기" / "신청 취소". */
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

// A card that reveals a colored action surface (icon + label) as it is swiped.
// Pointer Events + `touch-action: pan-y` (set in CSS) so vertical scrolling stays
// with the page. Intent uses a dead-zone-then-decide machine (never abandons on a
// noisy first sample — the bug that killed left-swipe on iPhone). Commit distance
// is a fraction of the card width. Swipe is an ENHANCEMENT: callers ALSO render a
// visible button that calls the same action.
export default function SwipeableCard({
  direction,
  onCommit,
  tone,
  icon,
  label,
  disabled = false,
  children,
}: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const intent = useRef<'pending' | 'horizontal' | 'vertical'>('pending');
  const threshold = useRef(96);

  function down(e: PointerEvent) {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Leave OS back/forward edge gestures alone.
    if (typeof window !== 'undefined' && isEdgeStart(e.clientX, window.innerWidth)) return;
    start.current = { x: e.clientX, y: e.clientY };
    intent.current = 'pending';
    threshold.current = commitThresholdPx(wrapRef.current?.getBoundingClientRect().width ?? 0);
  }

  function move(e: PointerEvent) {
    if (!start.current || disabled) return;
    const dX = e.clientX - start.current.x;
    const dY = e.clientY - start.current.y;

    if (intent.current === 'pending') {
      const decided = decideIntent(dX, dY, direction);
      if (decided === 'pending') return; // still in the dead zone — keep waiting
      intent.current = decided;
      if (decided === 'horizontal') {
        setDragging(true);
        try {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        } catch {
          /* not fatal */
        }
      } else {
        start.current = null; // vertical → let the page scroll
        return;
      }
    }
    if (intent.current === 'horizontal') setDx(clampToDirection(dX, direction));
  }

  function end() {
    if (intent.current === 'horizontal' && swipeCommitted(dx, direction, threshold.current)) {
      onCommit();
    }
    start.current = null;
    intent.current = 'pending';
    setDragging(false);
    setDx(0);
  }

  const progress = swipeProgress(dx, direction, threshold.current);
  const armed = progress >= 1;

  return (
    <div ref={wrapRef} className={`swipe-wrap tone-${tone} dir-${direction}`}>
      <div className="swipe-reveal" aria-hidden style={{ opacity: 0.4 + progress * 0.6 }}>
        <span className="swipe-ico">{icon}</span>
        <span className="swipe-label">{label}</span>
      </div>
      <div
        className={`swipe-content${dragging ? ' dragging' : ''}${armed ? ' armed' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {children}
      </div>
    </div>
  );
}
