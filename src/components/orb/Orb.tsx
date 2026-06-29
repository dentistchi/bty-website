"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · silhouette-isolated
 * light + reaction pulse).
 *
 * The "heart" of the ritual: a VOLUMETRIC sphere with ONE internal light that is
 * CLIPPED inside a fixed silhouette (no glow ever persists outside the sphere —
 * outside space is occupied only by a transient pulse). Contact merely leans the
 * inner warm centre slightly toward the finger; it does not spotlight-track.
 *
 * PRESENTATION ONLY — does NOT mount itself, persist, read the clock for a
 * "day", or call any API/DB. Colour is driven entirely by the P0a `--bty-orb-*`
 * tokens; every gradient stop is render-time DERIVED via color-mix (no new
 * tokens).
 *
 * Touch energy (glow + swell) is driven by PRESS STATE + DWELL ELAPSED in the
 * rAF loop. Stroking only moves the light origin — never resets dwell. Rebound
 * runs ONLY on pointer up/cancel (proportional ease-out). The reaction pulse
 * fires ONCE on arrival, concentric from the orb centre (not the contact point).
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
const DEFAULT_LY = 44; // core sits centre ~ a touch up (rest)
const CENTER = 50;
const MAX_DISP = 7; // ≈ radius(50) * 0.14 — only a slight inner lean, not a spotlight

const BREATH_PERIOD_MS = 4200;
const DWELL_FULL_MS = 1100; // press duration to reach full swell ceiling
const SETTLE_MIN_MS = 320; // shallow tap → quick settle
const SETTLE_MAX_MS = 1450; // deep hold → slow settle + long after-heat

type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

/** Clamp a contact point to a light-origin that only leans slightly from centre. */
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
  const targetRef = React.useRef({ x: DEFAULT_LX, y: DEFAULT_LY });
  const curRef = React.useRef({ x: DEFAULT_LX, y: DEFAULT_LY });
  const rafRef = React.useRef<number | null>(null);

  // Touch energy is ref-driven so the rAF loop owns it and it never rebounds on
  // a fixed timer or on a stroke move.
  const pressedRef = React.useRef(false);
  const pressStartRef = React.useRef(0);
  const intensityRef = React.useRef(0); // current displayed 0..1
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  // Reaction pulses — one per arrival, concentric from centre, removed on end.
  const [pulses, setPulses] = React.useState<number[]>([]);
  const pulseSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  const coreColor = lighten(baseTok, 26);
  const midColor = baseTok;
  const rimColor = darken(baseTok, 48);
  const emberBright = lighten(baseTok, 44);
  const emberMid = lighten(baseTok, 10);
  const pulseColor = lighten(baseTok, 42);

  // Single rAF loop: light-origin follow (--lx/--ly, clamped) + dwell-driven
  // energy (--core-op / --core-scale). Writes CSS vars only.
  React.useEffect(() => {
    const tick = () => {
      const t = now();

      const cur = curRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.2;
      cur.y += (tgt.y - cur.y) * 0.2;

      let intensity: number;
      if (pressedRef.current) {
        const dwell = clamp01((t - pressStartRef.current) / DWELL_FULL_MS);
        intensity = easeOutCubic(dwell);
      } else if (releaseRef.current.active) {
        const r = releaseRef.current;
        const rt = (t - r.startTs) / r.settleMs;
        if (rt >= 1) {
          intensity = 0;
          r.active = false;
        } else {
          intensity = r.from * (1 - easeOutCubic(rt));
        }
      } else {
        intensity = 0;
      }
      intensityRef.current = intensity;

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
    return { x, y };
  }, []);

  const spawnPulse = React.useCallback(() => {
    pulseSeq.current += 1;
    const id = pulseSeq.current;
    setPulses((prev) => [...prev, id]);
  }, []);

  // Contact arrival — the only place haptic fires AND the only place a pulse spawns.
  const beginPress = React.useCallback(
    (originX: number, originY: number) => {
      const t0 = invEaseOutCubic(clamp01(intensityRef.current));
      pressStartRef.current = now() - t0 * DWELL_FULL_MS;
      pressedRef.current = true;
      releaseRef.current.active = false;
      targetRef.current = { x: originX, y: originY };
      spawnPulse();
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch, spawnPulse]
  );

  const release = React.useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    const from = intensityRef.current;
    releaseRef.current = {
      active: true,
      from,
      startTs: now(),
      settleMs: SETTLE_MIN_MS + from * (SETTLE_MAX_MS - SETTLE_MIN_MS),
    };
    targetRef.current = { x: DEFAULT_LX, y: DEFAULT_LY };
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      const o = clampLean(p.x, p.y);
      beginPress(o.x, o.y);
    },
    [beginPress, toLocal]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressedRef.current) return;
      // POSITION ONLY — never touches dwell/intensity, never spawns a pulse.
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
      beginPress(DEFAULT_LX, DEFAULT_LY);
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

  const lightAt = "var(--lx, 50%) var(--ly, 44%)";
  const orbBody = `radial-gradient(circle at ${lightAt}, ${coreColor} 0%, ${midColor} 45%, ${rimColor} 100%)`;
  const orbEmber = `radial-gradient(circle at ${lightAt}, ${emberBright} 0%, ${emberMid} 30%, transparent 62%)`;
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
        borderRadius: "9999px",
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
        ["--lx" as string]: `${DEFAULT_LX}%`,
        ["--ly" as string]: `${DEFAULT_LY}%`,
        ["--core-op" as string]: "0.8",
        ["--core-scale" as string]: "1",
      }}
    >
      {/* Body — fixed silhouette, limb-darkened to the rim; overflow:hidden so the
          internal light can NEVER paint outside the sphere. Subtle breathing
          scale = life (#1). The ONE light core lives inside it (clipped). */}
      <motion.span
        aria-hidden
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          overflow: "hidden",
          background: orbBody,
          boxShadow: `inset 0 0 ${Math.round(size * 0.22)}px color-mix(in srgb, black 55%, transparent)`,
        }}
      >
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
            transformOrigin: "var(--lx, 50%) var(--ly, 44%)",
            willChange: "opacity, transform",
          }}
        />
      </motion.span>

      {/* Reaction pulse — concentric from centre, soft thin ring, 1-shot per
          arrival, removed from DOM on completion. Occupies outside space only
          transiently (it is the ONLY thing allowed beyond the silhouette). */}
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
            borderRadius: "9999px",
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
