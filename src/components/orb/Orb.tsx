"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · Living Response v3).
 *
 * "Don't animate the light — animate the LIFE inside the orb." The animated
 * subject is the energy FIELD DENSITY, not a highlight position. Touch
 * redistributes internal density toward the hand; any visible brightness is just
 * where density briefly gathered. There is NO bulb — luminance is spread across
 * several wide, low-opacity gradients so the user never perceives a "centre".
 *
 * ── HARD CONSTRAINT (squircle/UI-regression guard, highest priority) ─────────
 * - NO particles/dots as real elements (no dot/sprite/particle div/canvas). The
 *   field is gradient-density flow ONLY. "If you can see particles, it failed —
 *   it should only be felt."
 * - All inner light = comma-stacked radial-gradient(circle …) layers (≤5) on the
 *   body element's SINGLE background. NO child light layer, NO transform on the
 *   light, NO filter:blur on the light. Softness = wide stop spreads, never blur.
 * - body: border-radius:50%; overflow:hidden. Every gradient uses 'circle'.
 *
 * PRESENTATION ONLY — no mount, no persist, no clock/day, no API/DB. Colour is
 * render-time DERIVED from the P0a `--bty-orb-*` tokens via color-mix.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  #배타성 LOCK — HAPTIC EXCLUSIVITY (P0c, locked canon)                  ║
 * ║                                                                         ║
 * ║  `navigator.vibrate()` / any haptic call is permitted ONLY inside this  ║
 * ║  Orb component. The single sanctioned call site is `triggerOrbHaptic()` ║
 * ║  below — do not add a second. Haptic fires ONCE on contact ARRIVAL.     ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { motion } from "framer-motion";

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

/** The sole sanctioned haptic call site in the entire app (#배타성 LOCK). */
function triggerOrbHaptic(): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(18);
}

function baseTokenFor(mode: OrbMode): string {
  return mode === "morning" ? "var(--bty-orb-morning)" : "var(--bty-orb-evening)";
}
function lighten(token: string, pct: number): string {
  return `color-mix(in srgb, white ${pct}%, ${token})`;
}
function darken(token: string, pct: number): string {
  return `color-mix(in srgb, black ${pct}%, ${token})`;
}
/** Translucent version of a colour (literal alpha — no var). */
function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : 0;

const CENTER = 50;
const REST_Y = 46;
const MAX_DISP = 13; // ≈ radius(50) * 0.26 — the warm MASS visibly gathers toward the
// hand. Flashlight is avoided by a SOFT, BROAD profile (wide radii), not by limiting
// displacement: the brightest region leans directionally but never narrows to a pinpoint.

const BREATH_PERIOD_MS = 5200; // slow — noticed only after watching a while
const DWELL_FULL_MS = 3000; // ~3s ease-in accumulation (waking, never a snap)
const ONSET_MS = 70; // sense → perceive: brief no-flow window (not dead, not instant)
const SETTLE_MIN_MS = 600;
const SETTLE_MAX_MS = 2200; // deep hold → density slowly disperses back

// Five density layers (single background). Each center approaches the hand at its
// OWN speed + displacement → composite density FLOWS (no single layer is the
// star, none is a moving point). Edge is fully static (limb darkening = volume).
const LAYERS = [
  { key: "core", lean: 0.12, lerp: 0.02 }, // centre of mass — barely moves
  { key: "warm", lean: 1.0, lerp: 0.22 }, // body heat — gathers FAST & visibly (~150-250ms)
  { key: "amb", lean: 0.5, lerp: 0.09 }, // depth — mid
  { key: "touch", lean: 1.0, lerp: 0.06 }, // the ONE trailing liquid layer — arrives latest
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];

type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

function clampLean(x: number, y: number): { x: number; y: number } {
  let dx = x - CENTER;
  let dy = y - CENTER;
  const len = Math.hypot(dx, dy);
  if (len > MAX_DISP) {
    const s = MAX_DISP / len;
    dx *= s;
    dy *= s;
  }
  return { x: CENTER + dx, y: CENTER + dy };
}

export function Orb({
  mode,
  onTouch,
  size = 200,
  enableHaptic = true,
  ariaLabel,
}: OrbProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const targetRef = React.useRef({ x: CENTER, y: REST_Y });
  const posRef = React.useRef<Record<LayerKey, { x: number; y: number }>>({
    core: { x: CENTER, y: REST_Y },
    warm: { x: CENTER, y: REST_Y },
    amb: { x: CENTER, y: REST_Y },
    touch: { x: CENTER, y: REST_Y },
  });
  const rafRef = React.useRef<number | null>(null);

  const pressedRef = React.useRef(false);
  const pressTsRef = React.useRef(0); // real arrival time (for onset delay)
  const dwellStartRef = React.useRef(0); // accumulation clock (offset for re-press)
  const energyRef = React.useRef(0);
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  // Reaction pulse — separate layer, concentric from centre, removed on end.
  const [pulses, setPulses] = React.useState<number[]>([]);
  const pulseSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  // Distributed luminance — NO bulb, but the warm MASS must be perceptibly filled
  // (v3 over-flattened). Higher peak opacity, radii stay WIDE (mass, not a point).
  // Volume still from edge darkening.
  const coreColor = alpha(lighten(baseTok, 18), 46);
  const warmColor = alpha(lighten(baseTok, 16), 66); // v3.3: peak +1 notch (wide profile kept)
  const ambColor = alpha(lighten(baseTok, 7), 38);
  const touchColor = alpha(lighten(baseTok, 24), 58); // v3.3: near-side directional +1 notch
  const baseCenter = lighten(baseTok, 8); // gently filled inside, still not a highlight
  const rimColor = darken(baseTok, 38); // soft closure (no near-black)
  const pulseColor = lighten(baseTok, 40);

  // rAF loop: per-layer density centers flow toward the hand (each its own lag);
  // energy (accumulation) + breathing (independent, always on) drive radii.
  React.useEffect(() => {
    const tick = () => {
      const t = now();

      // onset: for the first ~120ms of a press the field does NOT flow yet.
      const onset = pressedRef.current && t - pressTsRef.current < ONSET_MS;
      const aim = onset ? { x: CENTER, y: REST_Y } : targetRef.current;
      const ox = aim.x - CENTER;
      const oy = aim.y - CENTER;

      // energy: ease-in accumulation while held (HOLDS at ceiling, position-
      // independent); proportional ease-out on release.
      let energy: number;
      if (pressedRef.current) {
        const dwell = clamp01((t - dwellStartRef.current) / DWELL_FULL_MS);
        energy = Math.pow(dwell, 1.5); // gentle ease-in — waking, not switching on
      } else if (releaseRef.current.active) {
        const r = releaseRef.current;
        const rt = (t - r.startTs) / r.settleMs;
        if (rt >= 1) {
          energy = 0;
          r.active = false;
        } else {
          energy = r.from * (1 - easeOutCubic(rt));
        }
      } else {
        energy = 0;
      }
      energyRef.current = energy;

      // breathing — INDEPENDENT of touch, never stops; dwell adds on top.
      const breath = Math.sin((t / BREATH_PERIOD_MS) * Math.PI * 2);

      const el = containerRef.current;
      if (el) {
        for (const layer of LAYERS) {
          const p = posRef.current[layer.key];
          p.x += (CENTER + ox * layer.lean - p.x) * layer.lerp;
          p.y += (CENTER + oy * layer.lean - p.y) * layer.lerp;
          el.style.setProperty(`--${layer.key}-x`, `${p.x}%`);
          el.style.setProperty(`--${layer.key}-y`, `${p.y}%`);
        }
        // wide radii; energy fills warm/ambient (accumulation), breathing swells
        // gently (+~20% vs prior). Softness via spread, never blur.
        // dwell visibly fills the warmth (0→3s clearly seen); breathing on top.
        el.style.setProperty("--core-r", `${44 + energy * 10 + breath * 6}%`);
        el.style.setProperty("--warm-r", `${52 + energy * 40 + breath * 3}%`);
        el.style.setProperty("--amb-r", `${66 + energy * 22}%`);
        el.style.setProperty("--touch-r", `${28 + energy * 20}%`);
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
    if (!el) return { x: CENTER, y: REST_Y };
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  }, []);

  const spawnPulse = React.useCallback(() => {
    pulseSeq.current += 1;
    const id = pulseSeq.current;
    setPulses((prev) => [...prev, id]);
  }, []);

  // Contact arrival — the only place haptic fires AND the only place a pulse spawns.
  const beginPress = React.useCallback(
    (origin: { x: number; y: number }) => {
      const t = now();
      // continue accumulation from residual energy (no dip on quick re-press).
      const t0 = Math.pow(clamp01(energyRef.current), 1 / 1.5); // inverse of dwell^1.5
      dwellStartRef.current = t - t0 * DWELL_FULL_MS;
      pressTsRef.current = t;
      pressedRef.current = true;
      releaseRef.current.active = false;
      targetRef.current = origin;
      spawnPulse();
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch, spawnPulse]
  );

  const release = React.useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    const from = energyRef.current;
    releaseRef.current = {
      active: true,
      from,
      startTs: now(),
      settleMs: SETTLE_MIN_MS + from * (SETTLE_MAX_MS - SETTLE_MIN_MS),
    };
    targetRef.current = { x: CENTER, y: REST_Y };
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      beginPress(clampLean(p.x, p.y));
    },
    [beginPress, toLocal]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressedRef.current) return;
      // POSITION ONLY — target updated; centers lag in rAF. Never touches energy.
      const p = toLocal(e.clientX, e.clientY);
      targetRef.current = clampLean(p.x, p.y);
    },
    [toLocal]
  );

  const onKeyDownActivate = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      beginPress({ x: CENTER, y: REST_Y });
    },
    [beginPress]
  );

  const onKeyUpRelease = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      release();
    },
    [release]
  );

  // Five comma-stacked radial-gradients on ONE background (no bulb): wide, low-
  // opacity warm fields over an opaque limb-darkened base. Order top→bottom.
  const orbBody = [
    `radial-gradient(circle at var(--touch-x,50%) var(--touch-y,46%), ${touchColor} 0%, transparent var(--touch-r,28%))`,
    `radial-gradient(circle at var(--core-x,50%) var(--core-y,46%), ${coreColor} 0%, transparent var(--core-r,44%))`,
    `radial-gradient(circle at var(--warm-x,50%) var(--warm-y,46%), ${warmColor} 0%, transparent var(--warm-r,52%))`,
    `radial-gradient(circle at var(--amb-x,50%) var(--amb-y,46%), ${ambColor} 0%, transparent var(--amb-r,66%))`,
    `radial-gradient(circle at 50% 50%, ${baseCenter} 0%, ${baseTok} 58%, ${rimColor} 100%)`,
  ].join(", ");
  const pulseRing = Math.max(2, Math.round(size * 0.012));

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? (mode === "morning" ? "Morning orb" : "Evening orb")}
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      // pointer captured on down; onPointerLeave is intentionally NOT a release.
      onKeyDown={onKeyDownActivate}
      onKeyUp={onKeyUpRelease}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
        ["WebkitTouchCallout" as string]: "none",
        ["WebkitUserDrag" as string]: "none",
        ["--core-x" as string]: "50%",
        ["--core-y" as string]: `${REST_Y}%`,
        ["--warm-x" as string]: "50%",
        ["--warm-y" as string]: `${REST_Y}%`,
        ["--amb-x" as string]: "50%",
        ["--amb-y" as string]: `${REST_Y}%`,
        ["--touch-x" as string]: "50%",
        ["--touch-y" as string]: `${REST_Y}%`,
        ["--core-r" as string]: "44%",
        ["--warm-r" as string]: "52%",
        ["--amb-r" as string]: "66%",
        ["--touch-r" as string]: "28%",
      }}
    >
      {/* Body — the sphere IS the volumetric field: ONE element, five stacked
          radial-gradients, no child layer, no transform, no blur. The diagonal
          stays a true circle. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: orbBody,
          boxShadow: `inset 0 0 ${Math.round(size * 0.16)}px color-mix(in srgb, black 32%, transparent)`,
        }}
      />

      {/* Reaction pulse — SEPARATE layer (allowed transform/blur), concentric
          from centre, 1-shot per arrival, removed on completion. */}
      {pulses.map((id) => (
        <motion.span
          key={id}
          aria-hidden
          initial={{ scale: 1, opacity: 0.22 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onAnimationComplete={() => setPulses((prev) => prev.filter((x) => x !== id))}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${pulseRing}px solid ${pulseColor}`,
            filter: `blur(${Math.round(size * 0.02)}px)`,
            pointerEvents: "none",
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
}

export default Orb;
