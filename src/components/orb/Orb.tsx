"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · Volumetric Light v2).
 *
 * The orb is not a painted disc — it is translucent warm MATTER with light
 * everywhere inside it. Touch does not move a highlight; it REARRANGES the
 * internal energy distribution. It responds, but is not dragged ("influence a
 * living thing, gently" — it answers without obeying).
 *
 * ── HARD CONSTRAINT (squircle-regression guard, highest priority) ────────────
 * ALL inner light is comma-stacked radial-gradient(circle …) layers on the body
 * element's SINGLE background. NO child light div/pseudo, NO transform on the
 * light, NO filter:blur on the light. (Any one of those makes a transformed/
 * blurred box escape the rounded clip → diagonal bleed = squircle. That is the
 * exact bug we removed.) Softness comes from wide gradient stop spreads, never
 * blur. Body: border-radius:50%; overflow:hidden. Every gradient uses 'circle'.
 *
 * PRESENTATION ONLY — no mount, no persist, no clock/day, no API/DB. Colour is
 * render-time DERIVED from the P0a `--bty-orb-*` tokens via color-mix (no new
 * tokens).
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  #배타성 LOCK — HAPTIC EXCLUSIVITY (P0c, locked canon)                  ║
 * ║                                                                         ║
 * ║  `navigator.vibrate()` / any haptic call is permitted ONLY inside this  ║
 * ║  Orb component. It is FORBIDDEN on buttons, toasts, notifications, XP    ║
 * ║  events, or anywhere else. The single sanctioned call site is            ║
 * ║  `triggerOrbHaptic()` below — do not add a second. Haptic fires ONCE on  ║
 * ║  contact ARRIVAL only (never on move/stroke/dwell/release).              ║
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

/**
 * The sole sanctioned haptic call site in the entire app (#배타성 LOCK).
 * Guarded by capability + the SSR boundary. No-op where unsupported
 * (e.g. iOS Safari does not implement the Vibration API → silent, visual only).
 */
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
/** Translucent version of a colour (for stacked light layers). */
function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : 0;

const CENTER = 50;
const REST_Y = 46;
const MAX_DISP = 6; // ≈ radius(50) * 0.12 — light never reaches the finger

const BREATH_PERIOD_MS = 5200; // slow — "noticed only after watching a while"
const DWELL_FULL_MS = 1500; // ease-in accumulation to full awakening
const SETTLE_MIN_MS = 400;
const SETTLE_MAX_MS = 1700; // deep hold → slow fade + long after-glow

// Five volumetric layers. Each center approaches the finger target with its own
// lean (how far it shifts) and lerp (how fast) → the energy MASS rearranges,
// liquid-like, never one synchronized highlight. Core barely moves (centre of
// mass); Warm Mass + Touch carry the shift; Edge is fully static (limb dark).
const LAYERS = [
  { key: "core", lean: 0.12, lerp: 0.025 },
  { key: "warm", lean: 1.0, lerp: 0.12 },
  { key: "amb", lean: 0.45, lerp: 0.05 },
  { key: "touch", lean: 1.0, lerp: 0.1 },
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];

type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

/** Clamp a contact point to an offset that only leans slightly from centre. */
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
  const pressStartRef = React.useRef(0);
  const energyRef = React.useRef(0);
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  // Reaction pulse — separate layer, concentric from centre, removed on end.
  const [pulses, setPulses] = React.useState<number[]>([]);
  const pulseSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  // Stacked light colours (translucent) + opaque limb-darkened base.
  const touchColor = alpha(lighten(baseTok, 34), 48);
  const coreColor = alpha(lighten(baseTok, 30), 80);
  const warmColor = alpha(lighten(baseTok, 15), 62);
  const ambColor = alpha(baseTok, 52);
  const baseCenter = lighten(baseTok, 6);
  const rimColor = darken(baseTok, 38); // soft closure (no near-black)
  const pulseColor = lighten(baseTok, 42);

  // Single rAF loop: per-layer centers lerp toward the finger target at their own
  // rates (liquid), and energy/breathing drive layer radii (accumulation + life).
  React.useEffect(() => {
    const tick = () => {
      const t = now();
      const ox = targetRef.current.x - CENTER; // clamped finger offset
      const oy = targetRef.current.y - CENTER;

      // energy: ease-IN accumulation while held (HOLDS at ceiling, position-
      // independent); proportional ease-OUT only on release.
      let energy: number;
      if (pressedRef.current) {
        const dwell = clamp01((t - pressStartRef.current) / DWELL_FULL_MS);
        energy = dwell * dwell; // ease-in — "waking something up"
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

      const breath = Math.sin((t / BREATH_PERIOD_MS) * Math.PI * 2);

      const el = containerRef.current;
      if (el) {
        // each layer drifts toward its own leaned target at its own speed
        for (const layer of LAYERS) {
          const p = posRef.current[layer.key];
          const tx = CENTER + ox * layer.lean;
          const ty = CENTER + oy * layer.lean;
          p.x += (tx - p.x) * layer.lerp;
          p.y += (ty - p.y) * layer.lerp;
          el.style.setProperty(`--${layer.key}-x`, `${p.x}%`);
          el.style.setProperty(`--${layer.key}-y`, `${p.y}%`);
        }
        // radii: energy fills the warm mass / ambient (accumulation); breathing
        // gently swells the core (life). Softness = wide spreads, never blur.
        el.style.setProperty("--core-r", `${27 + breath * 5}%`);
        el.style.setProperty("--warm-r", `${50 + energy * 24 + breath * 2.5}%`);
        el.style.setProperty("--amb-r", `${62 + energy * 14}%`);
        el.style.setProperty("--touch-r", `${18 + energy * 8}%`);
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
      // continue accumulation from residual energy (no dip on quick re-press).
      const t0 = Math.sqrt(clamp01(energyRef.current)); // inverse of ease-in (t^2)
      pressStartRef.current = now() - t0 * DWELL_FULL_MS;
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

  // Five comma-stacked radial-gradients on ONE background. Order = top→bottom:
  // Touch / Core / Warm Mass / Ambient / Edge(opaque limb-darkened base).
  const orbBody = [
    `radial-gradient(circle at var(--touch-x,50%) var(--touch-y,46%), ${touchColor} 0%, transparent var(--touch-r,18%))`,
    `radial-gradient(circle at var(--core-x,50%) var(--core-y,46%), ${coreColor} 0%, transparent var(--core-r,27%))`,
    `radial-gradient(circle at var(--warm-x,50%) var(--warm-y,46%), ${warmColor} 0%, transparent var(--warm-r,50%))`,
    `radial-gradient(circle at var(--amb-x,50%) var(--amb-y,46%), ${ambColor} 0%, transparent var(--amb-r,62%))`,
    `radial-gradient(circle at 50% 50%, ${baseCenter} 0%, ${baseTok} 55%, ${rimColor} 100%)`,
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
        // layer centers + radii (updated by rAF)
        ["--core-x" as string]: "50%",
        ["--core-y" as string]: `${REST_Y}%`,
        ["--warm-x" as string]: "50%",
        ["--warm-y" as string]: `${REST_Y}%`,
        ["--amb-x" as string]: "50%",
        ["--amb-y" as string]: `${REST_Y}%`,
        ["--touch-x" as string]: "50%",
        ["--touch-y" as string]: `${REST_Y}%`,
        ["--core-r" as string]: "27%",
        ["--warm-r" as string]: "50%",
        ["--amb-r" as string]: "62%",
        ["--touch-r" as string]: "18%",
      }}
    >
      {/* Body — the sphere IS the volumetric light: ONE element, five stacked
          radial-gradients, no child layer, no transform, no blur. border-radius
          + overflow:hidden close the silhouette; the diagonal stays a true circle. */}
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
          initial={{ scale: 1, opacity: 0.24 }}
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
