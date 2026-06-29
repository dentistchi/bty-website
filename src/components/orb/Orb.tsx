"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · v2 form+touch,
 * dwell state-binding fix).
 *
 * The "heart" of the ritual: a VOLUMETRIC sphere that breathes from within and
 * responds to sustained contact. PRESENTATION ONLY — does NOT mount itself,
 * persist, read the clock for a "day", or call any API/DB. Colour is driven
 * entirely by the P0a `--bty-orb-*` tokens; every gradient stop is render-time
 * DERIVED via color-mix (no new tokens).
 *
 * Touch energy (glow + swell) is driven by PRESS STATE + DWELL ELAPSED in the
 * rAF loop — never a fixed timer/keyframe. While held it eases up to a ceiling
 * and STAYS (no auto-decay). Rebound happens ONLY on release, with settle +
 * after-heat length PROPORTIONAL to how deep the swell got (short tap = shallow
 * = quick; long hold = deep = slow + long after-glow). Rebound curve is ease-out.
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

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const invEaseOutCubic = (y: number): number => 1 - Math.pow(1 - y, 1 / 3);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : 0;

const DEFAULT_LX = 50;
const DEFAULT_LY = 42; // core sits centre ~ slightly up

const BREATH_PERIOD_MS = 4200; // #1 breathing cadence
const DWELL_FULL_MS = 1100; // press duration to reach full swell ceiling
const SETTLE_MIN_MS = 320; // shallow tap → quick settle
const SETTLE_MAX_MS = 1450; // deep hold → slow settle + long after-heat

type Ripple = { id: number; x: number; y: number };
type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

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

  // Touch energy is ref-driven (no React state) so the rAF loop owns it and it
  // never rebounds on a fixed timer.
  const pressedRef = React.useRef(false);
  const pressStartRef = React.useRef(0);
  const intensityRef = React.useRef(0); // current displayed 0..1
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const rippleSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  const coreColor = lighten(baseTok, 26);
  const midColor = baseTok;
  const rimColor = darken(baseTok, 48);
  const emberBright = lighten(baseTok, 44);
  const emberMid = lighten(baseTok, 10);
  const atmoColor = darken(baseTok, 10);
  const flareColor = "var(--bty-orb-touch)";

  // Single rAF loop: light-follow (--lx/--ly) + dwell-driven energy
  // (--core-op / --core-scale). Writes CSS vars only — no per-frame re-render.
  React.useEffect(() => {
    const tick = () => {
      const t = now();

      // --- light position: ease toward target (stroke-follow / ease-out home) ---
      const cur = curRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.2;
      cur.y += (tgt.y - cur.y) * 0.2;

      // --- energy: pressed → ease-up & hold; released → proportional ease-out ---
      let intensity: number;
      if (pressedRef.current) {
        const dwell = clamp01((t - pressStartRef.current) / DWELL_FULL_MS);
        intensity = easeOutCubic(dwell); // rises, then HOLDS at ceiling (no decay)
      } else if (releaseRef.current.active) {
        const r = releaseRef.current;
        const rt = (t - r.startTs) / r.settleMs;
        if (rt >= 1) {
          intensity = 0;
          r.active = false;
        } else {
          intensity = r.from * (1 - easeOutCubic(rt)); // ease-out down (not clipped)
        }
      } else {
        intensity = 0;
      }
      intensityRef.current = intensity;

      // breathing (#1) — full at rest, damped as energy rises so a held orb
      // stays steady and never appears to rebound while pressed.
      const breath = Math.sin((t / BREATH_PERIOD_MS) * Math.PI * 2);
      const damp = 1 - 0.85 * intensity;
      const coreOp = clamp01(0.8 + 0.2 * intensity + breath * 0.12 * damp);
      const coreScale = 1 + 0.2 * intensity + breath * 0.02 * damp;

      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--lx", `${cur.x}%`);
        el.style.setProperty("--ly", `${cur.y}%`);
        el.style.setProperty("--core-op", `${coreOp}`);
        el.style.setProperty("--core-scale", `${coreScale}`);
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
    const c = (v: number) => Math.max(0, Math.min(100, v));
    return { x: c(x), y: c(y) };
  }, []);

  const spawnRipple = React.useCallback((x: number, y: number) => {
    rippleSeq.current += 1;
    const id = rippleSeq.current;
    setRipples((prev) => [...prev, { id, x, y }]);
  }, []);

  // Contact arrival — the only place haptic fires (#배타성 LOCK).
  const beginPress = React.useCallback(
    (x: number, y: number) => {
      // Continue dwell from any residual intensity (no dip on quick re-press).
      const t0 = invEaseOutCubic(clamp01(intensityRef.current));
      pressStartRef.current = now() - t0 * DWELL_FULL_MS;
      pressedRef.current = true;
      releaseRef.current.active = false;
      targetRef.current = { x, y };
      spawnRipple(x, y);
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch, spawnRipple]
  );

  const release = React.useCallback(() => {
    if (!pressedRef.current && !releaseRef.current.active) return;
    if (!pressedRef.current) return; // already releasing
    pressedRef.current = false;
    const from = intensityRef.current;
    // proportionality: deeper swell → slower settle + longer after-heat.
    releaseRef.current = {
      active: true,
      from,
      startTs: now(),
      settleMs: SETTLE_MIN_MS + from * (SETTLE_MAX_MS - SETTLE_MIN_MS),
    };
    targetRef.current = { x: DEFAULT_LX, y: DEFAULT_LY }; // ease-out home
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      beginPress(p.x, p.y);
    },
    [beginPress, toLocal]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressedRef.current) return;
      // No haptic on move. rAF loop throttles the visual follow.
      targetRef.current = toLocal(e.clientX, e.clientY);
    },
    [toLocal]
  );

  const onKeyActivate = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return; // hold key = sustained dwell, single arrival
      beginPress(DEFAULT_LX, DEFAULT_LY);
    },
    [beginPress]
  );

  const onKeyUp = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      release();
    },
    [release]
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
      onKeyUp={onKeyUp}
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
        ["--lx" as string]: `${DEFAULT_LX}%`,
        ["--ly" as string]: `${DEFAULT_LY}%`,
        ["--core-op" as string]: "0.8",
        ["--core-scale" as string]: "1",
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

      {/* Body — limb-darkened sphere; inset shadow deepens the rim to seat it.
          Subtle always-on breathing scale = life (#1), independent of touch. */}
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

      {/* Core ember — energy driven by dwell state via CSS vars (rAF). Light
          comes from WITHIN; opacity/scale rise & hold while pressed, ease-out
          only on release. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: orbEmber,
          mixBlendMode: "screen",
          opacity: "var(--core-op, 0.8)",
          transform: "scale(var(--core-scale, 1))",
          transformOrigin: "var(--lx, 50%) var(--ly, 42%)",
          pointerEvents: "none",
          willChange: "opacity, transform",
        }}
      />

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
