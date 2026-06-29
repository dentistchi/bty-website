"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · single-light + stroke
 * + callout-block).
 *
 * The "heart" of the ritual: a VOLUMETRIC sphere with ONE internal light. There
 * is no second overlay disk — contact is expressed only by the body's internal
 * light origin LEANING toward the contact point (clamped well inside the
 * silhouette, so no half-moon / hard second edge ever forms). The silhouette is
 * fixed; only the inner light moves. Limb darkening is constant (rim always
 * deep; the core merely relocates and brightens). Soft falloff only — no rings.
 *
 * PRESENTATION ONLY — does NOT mount itself, persist, read the clock for a
 * "day", or call any API/DB. Colour is driven entirely by the P0a `--bty-orb-*`
 * tokens; every gradient stop is render-time DERIVED via color-mix (no new
 * tokens).
 *
 * Touch energy (glow + swell) is driven by PRESS STATE + DWELL ELAPSED in the
 * rAF loop. Stroking only moves the light origin — it never resets/reduces
 * dwell. Rebound runs ONLY on pointer up/cancel (proportional ease-out). Pointer
 * is captured on down so a stroke that briefly leaves the bounds does not cut.
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
const DEFAULT_LY = 42; // core sits centre ~ slightly up (rest)
const CENTER = 50;
const MAX_DISP = 15; // ≈ radius(50) * 0.3 — light stays well inside the silhouette

const BREATH_PERIOD_MS = 4200;
const DWELL_FULL_MS = 1100; // press duration to reach full swell ceiling
const SETTLE_MIN_MS = 320; // shallow tap → quick settle
const SETTLE_MAX_MS = 1450; // deep hold → slow settle + long after-heat

type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

/** Clamp a contact point to a light-origin that never leaves the inner body. */
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

  // Touch energy is ref-driven (no React state) so the rAF loop owns it and it
  // never rebounds on a fixed timer or on a stroke move.
  const pressedRef = React.useRef(false);
  const pressStartRef = React.useRef(0);
  const intensityRef = React.useRef(0); // current displayed 0..1
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  const baseTok = baseTokenFor(mode);
  const coreColor = lighten(baseTok, 26);
  const midColor = baseTok;
  const rimColor = darken(baseTok, 48);
  const emberBright = lighten(baseTok, 44);
  const emberMid = lighten(baseTok, 10);
  const atmoColor = darken(baseTok, 10);

  // Single rAF loop: light-origin follow (--lx/--ly, clamped inside) + dwell-
  // driven energy (--core-op / --core-scale). Writes CSS vars only.
  React.useEffect(() => {
    const tick = () => {
      const t = now();

      // light origin: ease toward (clamped) target — lean on press, home on release.
      const cur = curRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.2;
      cur.y += (tgt.y - cur.y) * 0.2;

      // energy: pressed → ease-up & HOLD (position-independent); released → ease-out.
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

      // breathing (#1) — full at rest, damped as energy rises so a held orb
      // stays steady (no apparent rebound while pressed).
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

  // Contact arrival — the only place haptic fires (#배타성 LOCK).
  const beginPress = React.useCallback(
    (originX: number, originY: number) => {
      // Continue dwell from any residual intensity (no dip on quick re-press).
      const t0 = invEaseOutCubic(clamp01(intensityRef.current));
      pressStartRef.current = now() - t0 * DWELL_FULL_MS;
      pressedRef.current = true;
      releaseRef.current.active = false;
      targetRef.current = { x: originX, y: originY };
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch]
  );

  const release = React.useCallback(() => {
    if (!pressedRef.current) return; // only a real press rebounds
    pressedRef.current = false;
    const from = intensityRef.current;
    releaseRef.current = {
      active: true,
      from,
      startTs: now(),
      // proportionality: deeper swell → slower settle + longer after-heat.
      settleMs: SETTLE_MIN_MS + from * (SETTLE_MAX_MS - SETTLE_MIN_MS),
    };
    targetRef.current = { x: DEFAULT_LX, y: DEFAULT_LY }; // ease-out home
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
      // POSITION ONLY — never touches dwell/intensity/pressStart, never rebounds.
      const p = toLocal(e.clientX, e.clientY);
      targetRef.current = clampLean(p.x, p.y);
    },
    [toLocal]
  );

  const onKeyDownActivate = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return; // held key = sustained dwell, single arrival
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
      draggable={false}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      // NOTE: pointer is captured on down; onPointerLeave is intentionally NOT a
      // release so a stroke that briefly leaves the bounds is not cut off.
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
        // long-press copy/callout + drag suppression
        ["WebkitTouchCallout" as string]: "none",
        ["WebkitUserDrag" as string]: "none",
        // light position + energy (updated by rAF)
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

      {/* Body — fixed silhouette, limb-darkened; inset shadow deepens the rim.
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

      {/* The ONE internal light core — same origin as the body gradient, so the
          orb has a single light that leans/brightens. Soft falloff, no ring. */}
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
    </div>
  );
}

export default Orb;
