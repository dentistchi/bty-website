"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b).
 *
 * The "heart" of the ritual: a living surface that breathes at baseline and
 * flares on touch. PRESENTATION ONLY — this component does NOT mount itself,
 * persist anything, read the clock for a "day", or call any API/DB. Colour is
 * driven entirely by the P0a `--bty-orb-*` tokens (see globals.css).
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  #배타성 LOCK — HAPTIC EXCLUSIVITY (P0c, locked canon)                  ║
 * ║                                                                         ║
 * ║  `navigator.vibrate()` / any haptic call is permitted ONLY inside this  ║
 * ║  Orb component. It is FORBIDDEN on buttons, toasts, notifications, XP    ║
 * ║  events, or anywhere else. Touch is the Orb's exclusive language; if     ║
 * ║  everything buzzes, nothing means anything. The single sanctioned call   ║
 * ║  site is `triggerOrbHaptic()` below — do not add a second.               ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type OrbMode = "morning" | "evening";

export interface OrbProps {
  /** Time-of-ritual mode — drives baseline colour from the P0a tokens. */
  mode: OrbMode;
  /** Fired on a completed touch (after the flare begins). Presentation callback only. */
  onTouch?: () => void;
  /** Pixel diameter of the orb. Defaults to 200. */
  size?: number;
  /**
   * Whether the orb may fire its haptic pulse on touch. Defaults to true.
   * This is the ONLY haptic toggle in the app (see #배타성 LOCK above).
   */
  enableHaptic?: boolean;
  /** Accessible label for the touch target. */
  ariaLabel?: string;
}

/**
 * The sole sanctioned haptic call site in the entire app (#배타성 LOCK).
 * Guarded by capability + the SSR boundary. No-op where unsupported.
 */
function triggerOrbHaptic(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  // A soft, single pulse — the orb's "answer" to a touch, not an alert.
  navigator.vibrate(18);
}

/** Resolve the baseline orb colour token for a given mode. */
function baselineColorVar(mode: OrbMode): string {
  return mode === "morning" ? "var(--bty-orb-morning)" : "var(--bty-orb-evening)";
}

type Ripple = { id: number };

export function Orb({
  mode,
  onTouch,
  size = 200,
  enableHaptic = true,
  ariaLabel,
}: OrbProps): React.ReactElement {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const rippleSeq = React.useRef(0);

  const baseColor = baselineColorVar(mode);
  const flareColor = "var(--bty-orb-touch)";

  const handleTouch = React.useCallback(() => {
    // Spawn a one-shot ripple (keyed; AnimatePresence cleans it up on exit).
    rippleSeq.current += 1;
    const id = rippleSeq.current;
    setRipples((prev) => [...prev, { id }]);

    if (enableHaptic) triggerOrbHaptic();
    onTouch?.();
  }, [enableHaptic, onTouch]);

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel ?? (mode === "morning" ? "Morning orb" : "Evening orb")}
      onClick={handleTouch}
      whileTap={{ scale: 0.96 }}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "9999px",
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: "transparent",
        display: "grid",
        placeItems: "center",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
      }}
    >
      {/* Breathing core — the "life" of the orb (subtle, continuous). */}
      <motion.span
        aria-hidden
        animate={{ scale: [1, 1.045, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: `radial-gradient(circle at 50% 42%, ${flareColor} 0%, ${baseColor} 55%, color-mix(in srgb, ${baseColor} 70%, black) 100%)`,
          boxShadow: `0 0 ${size * 0.22}px color-mix(in srgb, ${baseColor} 60%, transparent)`,
        }}
      />

      {/* Touch flare — one-shot expanding waves on each touch. */}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            aria-hidden
            initial={{ scale: 0.6, opacity: 0.55 }}
            animate={{ scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onAnimationComplete={() =>
              setRipples((prev) => prev.filter((x) => x.id !== r.id))
            }
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              border: `2px solid ${flareColor}`,
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}

export default Orb;
