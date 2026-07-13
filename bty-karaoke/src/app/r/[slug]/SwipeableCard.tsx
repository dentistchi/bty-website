'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  isHorizontalIntent,
  clampToDirection,
  swipeProgress,
  swipeCommitted,
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

// A card that reveals a colored action surface (icon + label) as it is swiped,
// springs back under the threshold, and commits once past it. Swipe is an
// ENHANCEMENT — callers must also render a visible button that calls the same
// action. Vertical scrolling is preserved (touch-action: pan-y + intent gate);
// reduced-motion is honored via CSS transitions.
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
  const start = useRef<{ x: number; y: number } | null>(null);
  const claimed = useRef(false);

  function down(e: PointerEvent) {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    claimed.current = false;
  }

  function move(e: PointerEvent) {
    if (!start.current || disabled) return;
    const rawDx = e.clientX - start.current.x;
    const rawDy = e.clientY - start.current.y;

    if (!claimed.current) {
      if (isHorizontalIntent(rawDx, rawDy) && clampToDirection(rawDx, direction) !== 0) {
        claimed.current = true;
        setDragging(true);
        try {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        } catch {
          /* not fatal */
        }
      } else if (Math.abs(rawDy) > Math.abs(rawDx)) {
        // Clearly vertical → let the page scroll; abandon this gesture.
        start.current = null;
      }
      return;
    }
    setDx(clampToDirection(rawDx, direction));
  }

  function up() {
    if (claimed.current && swipeCommitted(dx, direction)) onCommit();
    start.current = null;
    claimed.current = false;
    setDragging(false);
    setDx(0);
  }

  const progress = swipeProgress(dx, direction);
  const armed = progress >= 1;

  return (
    <div className={`swipe-wrap tone-${tone} dir-${direction}`}>
      <div className="swipe-reveal" aria-hidden style={{ opacity: 0.4 + progress * 0.6 }}>
        <span className="swipe-ico">{icon}</span>
        <span className="swipe-label">{label}</span>
      </div>
      <div
        className={`swipe-content${dragging ? ' dragging' : ''}${armed ? ' armed' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </div>
    </div>
  );
}
