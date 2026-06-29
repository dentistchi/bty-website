"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · v2 form+touch).
 *
 * The "heart" of the ritual: a VOLUMETRIC sphere that breathes from within and
 * responds to contact (press, stroke, dwell, release). PRESENTATION ONLY — does
 * NOT mount itself, persist, read the clock for a "day", or call any API/DB.
 * Colour is driven entirely by the P0a `--bty-orb-*` tokens; every gradient
 * stop is render-time DERIVED from those tokens via color-mix (no new tokens).
 *
 * v2 (heart, not sun): limb-darkened body (core bright → rim deep), inner ember
 * that pulses harder than the body, restrained 1-layer atmosphere, NO external
 * specular highlight. Touch = pointer grammar: light follows the finger.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  #배타성 LOCK — HAPTIC EXCLUSIVITY (P0c, locked canon)                  ║
 * ║                                                                         ║
 * ║  `navigator.vibrate()` / any haptic call is permitted ONLY inside this  ║
 * ║  Orb component. It is FORBIDDEN on buttons, toasts, notifications, XP    ║
 * ║  events, or anywhere else. Touch is the Orb's exclusive language; if     ║
 * ║  everything buzzes, nothing means anything. The single sanctioned call   ║
 * ║  site is `triggerOrbHaptic()` below — do not add a second. Haptic fires   ║
 * ║  ONCE on contact arrival only (never on move/stroke).                    ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type OrbMode = "morning" | "evening";

export interface OrbProps {
  /** Time-of-ritual mode — drives baseline colour from the P0a tokens. */
  mode: OrbMode;
  /** Fired on a completed contact arrival (press / keyboard activate). */
  onTouch?: () => void;
  /** Pixel diameter of the orb. Defaults to 200. */
  size?: number;
  /**
   * Whether the orb may fire its haptic pulse on contact. Defaults to true.
   * This is the ONLY haptic toggle in the app (see #배타성 LOCK above).
   */
  enableHaptic?: boolean;
  /** Accessible label for the touch target. */
  ariaLabel?: string;
}

/**
 * The sole sanctioned haptic call site in the entire app (#배타성 LOCK).
 * Guarded by capability + the SSR boundary. No-op where unsupported
 * (e.g. iOS Safari does not implement the Vibration API → silent, visual only).
 */
function triggerOrbHaptic(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  // A soft, single pulse — the orb's "answer" to a touch, not an alert.
  navigator.vibrate(18);
}

/** Baseline body colour token for a mode. */
function baseTokenFor(mode: OrbMode): string {
  return mode === "morning" ? "var(--bty-orb-morning)" : "var(--bty-orb-evening)";
}

/** Render-time derivations (lighten/darken) from the base orb token — no new named tokens. */
function lighten(token: string, pct: number): string {
  return `color-mix(in srgb, white ${pct}%, ${token})`;
}
function darken(token: string, pct: number): string {
  return `color-mix(in srgb, black ${pct}%, ${token})`;
}

const DEFAULT_LX = 50;
const DEFAULT_LY = 42; // core sits centre ~ slightly up

type Ripple = { id: number; x: number; y: number };

export function Orb({
  mode,
  onTouch,
  size = 200,
  enableHaptic = true,
  ariaLabel,
}: OrbProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const targetRef = React.useRef({ x: DEFAULT_LX, y: DEFAULT_LY });
  const curRef = React.useRef({ x: DEFAULT_LX, y: DEFAULT_LY });
  const rafRef = React.useRef<number | null>(null);

  const [pressed, setPressed] = React.useState(false);
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const [afterglow, setAfterglow] = React.useState(0); // bump to retrigger after-heat
  const rippleSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  // Body: bright core → mid → deep rim (limb darkening seats the sphere).
  const coreColor = lighten(baseTok, 26);
  const midColor = baseTok;
  const rimColor = darken(baseTok, 48);
  // Inner ember: warmer/brighter cluster with a soft transparent edge.
  const emberBright = lighten(baseTok, 44);
  const emberMid = lighten(baseTok, 10);
  // Atmosphere: one restrained outer layer (never a big bloom).
  const atmoColor = darken(baseTok, 10);
  // Contact flare — the Orb's "touch" colour token.
  const flareColor = "var(--bty-orb-touch)";

  // rAF loop: ease the rendered light position toward the target (stroke-follow
  // on press; ease-out return to centre on release). Writes CSS vars only — no
  // React re-render per frame.
  React.useEffect(() => {
    const tick = () => {
      const cur = curRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.2;
      cur.y += (tgt.y - cur.y) * 0.2;
      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--lx", `${cur.x}%`);
        el.style.setProperty("--ly", `${cur.y}%`);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toLocal = React.useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: DEFAULT_LX, y: DEFAULT_LY };
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    return { x: clamp(x), y: clamp(y) };
  }, []);

  const spawnRipple = React.useCallback((x: number, y: number) => {
    rippleSeq.current += 1;
    const id = rippleSeq.current;
    setRipples((prev) => [...prev, { id, x, y }]);
  }, []);

  // Contact arrival — the only place haptic fires (#배타성 LOCK).
  const handleArrival = React.useCallback(
    (x: number, y: number) => {
      targetRef.current = { x, y };
      setPressed(true);
      spawnRipple(x, y);
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch, spawnRipple]
  );

  const release = React.useCallback(() => {
    setPressed(false);
    targetRef.current = { x: DEFAULT_LX, y: DEFAULT_LY }; // ease-out home
    setAfterglow((n) => n + 1); // after-heat
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      handleArrival(p.x, p.y);
    },
    [handleArrival, toLocal]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressed) return;
      // No haptic on move. rAF loop throttles the visual follow.
      targetRef.current = toLocal(e.clientX, e.clientY);
    },
    [pressed, toLocal]
  );

  const onKeyActivate = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      handleArrival(DEFAULT_LX, DEFAULT_LY);
      // keyboard has no pointer-up; settle shortly after.
      window.setTimeout(release, 280);
    },
    [handleArrival, release]
  );

  const lightAt = "var(--lx, 50%) var(--ly, 42%)";
  const orbBody = `radial-gradient(circle at ${lightAt}, ${coreColor} 0%, ${midColor} 45%, ${rimColor} 100%)`;
  const orbEmber = `radial-gradient(circle at ${lightAt}, ${emberBright} 0%, ${emberMid} 30%, transparent 62%)`;
  const orbAtmo = `radial-gradient(circle at ${lightAt}, ${atmoColor} 0%, transparent 68%)`;

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? (mode === "morning" ? "Morning orb" : "Evening orb")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onKeyDown={onKeyActivate}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "9999px",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
        // light position (updated by rAF); defaults seat the core centre~up.
        ["--lx" as string]: `${DEFAULT_LX}%`,
        ["--ly" as string]: `${DEFAULT_LY}%`,
      }}
    >
      {/* Atmosphere — one restrained outer layer (no big bloom). */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.09)}px`,
          borderRadius: "9999px",
          background: orbAtmo,
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />

      {/* Body — limb-darkened sphere; inset shadow deepens the rim to seat it. */}
      <motion.span
        aria-hidden
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: orbBody,
          boxShadow: `inset 0 0 ${Math.round(size * 0.22)}px color-mix(in srgb, black 55%, transparent)`,
        }}
      />

      {/* Core ember — pulses harder than the body; swells on dwell (ease-in),
          eases home on release. Light comes from WITHIN. */}
      <motion.span
        aria-hidden
        animate={{ scale: pressed ? 1.18 : 1 }}
        transition={{ duration: pressed ? 1.2 : 0.8, ease: pressed ? "easeIn" : "easeOut" }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.09, 1], opacity: [0.78, 1, 0.78] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: orbEmber,
            mixBlendMode: "screen",
          }}
        />
      </motion.span>

      {/* After-heat — brief residual glow on release (~0.8s). */}
      <AnimatePresence>
        {afterglow > 0 && (
          <motion.span
            key={`afterglow-${afterglow}`}
            aria-hidden
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: orbEmber,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Contact flare — expands from the touch point. */}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            aria-hidden
            initial={{ scale: 0.35, opacity: 0.5 }}
            animate={{ scale: 2.3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onAnimationComplete={() =>
              setRipples((prev) => prev.filter((x) => x.id !== r.id))
            }
            style={{
              position: "absolute",
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: size * 0.42,
              height: size * 0.42,
              marginLeft: -(size * 0.42) / 2,
              marginTop: -(size * 0.42) / 2,
              borderRadius: "9999px",
              border: `2px solid ${flareColor}`,
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default Orb;
