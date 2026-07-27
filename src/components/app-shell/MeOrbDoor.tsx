"use client";

import React from "react";
import OrbLiving from "@/components/orb/OrbLiving";
import { ORB_HOLD_MS } from "@/components/orb/orbEntryContract";

/**
 * MeOrbDoor (Slice 3.2C-B3A.2D-R1) — the in-shell Me Orb, wired to the ONE canonical Orb runtime
 * ({@link OrbLiving}) with dual interaction:
 *
 *   SHORT TAP  → open the This Week detail (onOpenWeek)
 *   LONG HOLD  → enter the canonical Orb experience (onEnter), reusing the SAME threshold,
 *                progress feedback, haptics and golden entry-light as the /start cold-launch door.
 *
 * No second Orb engine / canvas / haptic timing is introduced — the visuals, the ~3s hold, the
 * ramping haptics and the golden overlay all belong to OrbLiving. This file only supplies the
 * gesture wiring (via OrbLiving's onTap/onCommit), an accessible keyboard mirror, the two-line
 * instruction, and the B3A.2D touch protections. The startup Orb is untouched.
 */

const COPY = {
  en: { tap: "Tap for this week", hold: "Hold to enter", aria: "This week — tap to open, hold to enter" },
  ko: { tap: "탭하여 이번 주 보기", hold: "길게 눌러 입장", aria: "이번 주 — 탭하여 열기, 길게 눌러 입장" },
};

export default function MeOrbDoor({
  locale,
  onEnter,
  onOpenWeek,
  size = 200,
}: {
  locale: string;
  onEnter: () => void;
  onOpenWeek: () => void;
  size?: number;
}) {
  const loc = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  // Long-hold canonical entry fires at most once (guards the pointer + keyboard paths together).
  const enteredRef = React.useRef(false);
  const enter = React.useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    onEnter();
  }, [onEnter]);

  // Keyboard mirror of the canonical press-and-hold, so the dual gesture is operable/testable
  // without the canvas (OrbLiving's pointer path owns the on-device gesture). A quick key press
  // is a short TAP → This Week; a key HELD ≥ the shared threshold enters, and that entry
  // suppresses the trailing keyup tap. An early release / blur resets an incomplete hold.
  const keyHoldRef = React.useRef<number | null>(null);
  const keyEnteredRef = React.useRef(false);
  const startKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) return;
    keyEnteredRef.current = false;
    keyHoldRef.current = window.setTimeout(() => {
      keyHoldRef.current = null;
      keyEnteredRef.current = true; // hold completed → the following keyup must NOT open This Week
      enter();
    }, ORB_HOLD_MS);
  }, [enter]);
  const endKeyHold = React.useCallback(() => {
    const pending = keyHoldRef.current;
    if (pending != null) {
      clearTimeout(pending);
      keyHoldRef.current = null;
    }
    if (keyEnteredRef.current) {
      keyEnteredRef.current = false; // completed hold → suppress the trailing tap
      return;
    }
    if (pending != null) onOpenWeek(); // released before threshold → short tap
  }, [onOpenWeek]);
  const cancelKeyHold = React.useCallback(() => {
    if (keyHoldRef.current != null) {
      clearTimeout(keyHoldRef.current);
      keyHoldRef.current = null;
    }
    keyEnteredRef.current = false;
  }, []);
  React.useEffect(() => () => cancelKeyHold(), [cancelKeyHold]);

  return (
    <div className="flex flex-col items-center gap-1.5 pb-4 pt-1 select-none" data-testid="me-orb-door">
      <div
        role="button"
        tabIndex={0}
        aria-label={t.aria}
        data-testid="me-orb-door-control"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            startKeyHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            endKeyHold();
          }
        }}
        onBlur={cancelKeyHold}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={
          {
            touchAction: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitUserDrag: "none",
            WebkitTapHighlightColor: "transparent",
          } as React.CSSProperties
        }
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <OrbLiving size={size} holdMs={ORB_HOLD_MS} onCommit={enter} onTap={onOpenWeek} />
      </div>
      {/* Two-line instruction — both interactions are discoverable (short-tap info must not be hidden). */}
      <div className="flex flex-col items-center gap-0.5" data-testid="me-orb-caption">
        <p className="text-xs tracking-[0.16em] text-white/55">{t.tap}</p>
        <p className="text-[0.7rem] tracking-[0.16em] text-white/35">{t.hold}</p>
      </div>
    </div>
  );
}
