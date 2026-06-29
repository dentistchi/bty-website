"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · Living Response v3.5,
 * weighted gather physics).
 *
 * Model: warm light is spread evenly through the orb; touch is a gravity well at
 * the fingertip that GATHERS the density toward it. Far = slow, nearer = faster,
 * gathered = brighter; not all of it can arrive, so it settles at a ceiling.
 * Lift → it slowly disperses back. The motion subject is the field DENSITY, not
 * a highlight; a single progress value `g` (0→1) drives gather + fill + bright.
 *
 * ── HARD CONSTRAINT (squircle/UI-regression guard, highest priority) ─────────
 * - NO particles/dots as real elements — density via gradients only.
 * - All inner light = comma-stacked radial-gradient(circle …) (≤5) on the body
 *   element's SINGLE background. NO child light layer, NO transform on the light,
 *   NO filter:blur on the light. Softness = wide stop spreads, never blur.
 * - body: border-radius:50%; overflow:hidden. Every gradient uses 'circle'.
 *
 * PRESENTATION ONLY — no mount, persist, clock/day, or API/DB. Colour is
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
function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : 0;

const CENTER = 50;
const REST_Y = 46;
const MAX_DISP = 13; // ≈ radius(50) * 0.26 — gather displacement cap (no flashlight)

const BREATH_PERIOD_MS = 5200; // slow, independent heartbeat
const ONSET_MS = 70; // brief sense beat before the gather begins

// Weighted gather: g self-accelerates (slow → fast) while held, caps at 1
// (ceiling), then holds. dg/dt = K·(BASE + g) → reaches ~ceiling in ~2.5s.
const GATHER_K = 0.85; // per second
const GATHER_BASE = 0.15;
const TRAIL_LERP = 0.06; // trailing layer follows g laggier (liquid separation)
const OFFSET_LERP = 0.2; // direction smoothing (not the weight — g is the weight)
const RELEASE_BASE_MS = 1300; // disperse slightly slower than it gathered
const RELEASE_SCALE_MS = 2200;

// v3.7/3.8 — two INDEPENDENT levers (flip either back without touching the other).
const A_PULSE_VISIBLE = true; // A: pulse visibility +1 (peak opacity + stroke)
const B_PRESS_GIVE = true; // B: micro press-give flinch (snail's-eye, not a button)
const GIVE_MAX = 0.012; // ≤1.2% inward — a flinch, never a sustained depress (v3.7 depth)
// v3.9 ASYMMETRIC curve = life: sharp reflexive contract → very slow recovery (~15×).
// Give runs its own timeline (independent of hold): contract→recover completes ONCE even
// while the finger stays down (habituation = life), while gather/warmth keeps building.
const GIVE_CONTRACT_MS = 60; // 탁 — sharper snap in (ease-out)
const GIVE_RECOVER_MS = 900; // 스르르 — much slower melt to baseline (15× contract)

// Each layer leans toward the finger by lean·g (Warm/Touch carry the gather;
// Core barely moves = centre of mass; Edge static). Touch uses gTrail (latest).
const LAYERS = [
  { key: "core", lean: 0.12, useTrail: false },
  { key: "warm", lean: 1.0, useTrail: false },
  { key: "amb", lean: 0.5, useTrail: false },
  { key: "touch", lean: 1.0, useTrail: true },
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];

type ReleaseState = { active: boolean; from: number; startTs: number; settleMs: number };

function clampLeanOffset(x: number, y: number): { x: number; y: number } {
  let dx = x - CENTER;
  let dy = y - CENTER;
  const len = Math.hypot(dx, dy);
  if (len > MAX_DISP) {
    const s = MAX_DISP / len;
    dx *= s;
    dy *= s;
  }
  return { x: dx, y: dy };
}

export function Orb({
  mode,
  onTouch,
  size = 200,
  enableHaptic = true,
  ariaLabel,
}: OrbProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const targetOffRef = React.useRef({ x: 0, y: 0 }); // finger offset from centre
  const dispOffRef = React.useRef({ x: 0, y: 0 }); // smoothed displayed offset
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef(0);

  const pressedRef = React.useRef(false);
  const pressTsRef = React.useRef(0);
  const gRef = React.useRef(0); // gather progress 0..1 (gather + fill + brightness)
  const gTrailRef = React.useRef(0);
  const giveStartRef = React.useRef(-1); // B: flinch start timestamp (-1 = inactive)
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });

  // Reaction pulse — separate layer, concentric from centre, removed on end.
  const [pulses, setPulses] = React.useState<number[]>([]);
  const pulseSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  // v3.4 luminance levels (peak held; the RAMP now comes from g, not opacity).
  const coreColor = alpha(lighten(baseTok, 18), 46);
  const warmColor = alpha(lighten(baseTok, 16), 74);
  const ambColor = alpha(lighten(baseTok, 7), 38);
  const touchColor = alpha(lighten(baseTok, 24), 66);
  const baseCenter = lighten(baseTok, 8);
  const rimColor = darken(baseTok, 38);
  const pulseColor = lighten(baseTok, 40);

  React.useEffect(() => {
    const tick = () => {
      const t = now();
      let dt = lastTsRef.current ? (t - lastTsRef.current) / 1000 : 0.016;
      lastTsRef.current = t;
      if (dt > 0.05) dt = 0.05; // clamp after tab-away

      // direction smoothing (the *weight/timing* is g, not this)
      const off = dispOffRef.current;
      const tgt = targetOffRef.current;
      off.x += (tgt.x - off.x) * OFFSET_LERP;
      off.y += (tgt.y - off.y) * OFFSET_LERP;

      // gather progress g: self-accelerating ease-in while held (after onset),
      // caps at ceiling; proportional ease-out on release (a touch slower).
      let g = gRef.current;
      if (pressedRef.current) {
        if (t - pressTsRef.current >= ONSET_MS) {
          g += dt * GATHER_K * (GATHER_BASE + g);
          if (g > 1) g = 1;
        }
      } else if (releaseRef.current.active) {
        const r = releaseRef.current;
        const rt = (t - r.startTs) / r.settleMs;
        if (rt >= 1) {
          g = 0;
          r.active = false;
        } else {
          g = r.from * (1 - easeOutCubic(rt));
        }
      } else {
        g = 0;
      }
      gRef.current = g;
      // trailing layer lags g (one layer never quite keeps up → liquid)
      gTrailRef.current += (g - gTrailRef.current) * TRAIL_LERP;
      const gTrail = gTrailRef.current;

      const breath = Math.sin((t / BREATH_PERIOD_MS) * Math.PI * 2);

      // B (v3.8): asymmetric press-give — fast contract, slow recover, one-shot.
      let give = 0;
      if (B_PRESS_GIVE && giveStartRef.current >= 0) {
        const e = t - giveStartRef.current;
        if (e < GIVE_CONTRACT_MS) {
          give = GIVE_MAX * easeOutCubic(e / GIVE_CONTRACT_MS); // 탁 in
        } else if (e < GIVE_CONTRACT_MS + GIVE_RECOVER_MS) {
          give = GIVE_MAX * (1 - easeOutCubic((e - GIVE_CONTRACT_MS) / GIVE_RECOVER_MS)); // 스르르 out
        } else {
          giveStartRef.current = -1; // settled to baseline (even while still held)
        }
      }

      const el = containerRef.current;
      if (el) {
        for (const layer of LAYERS) {
          const gg = layer.useTrail ? gTrail : g;
          const cx = CENTER + off.x * layer.lean * gg;
          const cy = REST_Y + off.y * layer.lean * gg;
          el.style.setProperty(`--${layer.key}-x`, `${cx}%`);
          el.style.setProperty(`--${layer.key}-y`, `${cy}%`);
        }
        // fill ramps with g (gather → brighter near-side); breathing on top.
        el.style.setProperty("--core-r", `${44 + g * 10 + breath * 6}%`);
        el.style.setProperty("--warm-r", `${52 + g * 40 + breath * 3}%`);
        el.style.setProperty("--amb-r", `${66 + g * 22}%`);
        // v3.6: near-side gather fill +1 notch (gain 20→30) — brighter at the HOLD
        // ceiling only; idle (gTrail=0) stays 28% = unchanged. Wider, not a hotspot.
        el.style.setProperty("--touch-r", `${28 + gTrail * 30}%`);
        // B: whole-sphere micro give (uniform scale on body = squircle-safe).
        el.style.setProperty("--give-scale", `${1 - give}`);
        el.style.setProperty("--give-dark", `${GIVE_MAX > 0 ? give / GIVE_MAX : 0}`);
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
    (offset: { x: number; y: number }) => {
      pressTsRef.current = now();
      pressedRef.current = true;
      releaseRef.current.active = false; // g continues from its current value
      targetOffRef.current = offset;
      if (B_PRESS_GIVE) giveStartRef.current = now(); // trigger the flinch (one-shot)
      spawnPulse();
      if (enableHaptic) triggerOrbHaptic();
      onTouch?.();
    },
    [enableHaptic, onTouch, spawnPulse]
  );

  const release = React.useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    const from = gRef.current;
    releaseRef.current = {
      active: true,
      from,
      startTs: now(),
      // disperse time ∝ how far it gathered (deeper → slower scatter).
      settleMs: RELEASE_BASE_MS + from * RELEASE_SCALE_MS,
    };
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      beginPress(clampLeanOffset(p.x, p.y));
    },
    [beginPress, toLocal]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressedRef.current) return;
      // DIRECTION ONLY — magnitude/timing is g. Never touches g here.
      const p = toLocal(e.clientX, e.clientY);
      targetOffRef.current = clampLeanOffset(p.x, p.y);
    },
    [toLocal]
  );

  const onKeyDownActivate = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      beginPress({ x: 0, y: 0 });
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

  // Five comma-stacked radial-gradients on ONE background. Wide, soft fields.
  const orbBody = [
    `radial-gradient(circle at var(--touch-x,50%) var(--touch-y,46%), ${touchColor} 0%, transparent var(--touch-r,28%))`,
    `radial-gradient(circle at var(--core-x,50%) var(--core-y,46%), ${coreColor} 0%, transparent var(--core-r,44%))`,
    `radial-gradient(circle at var(--warm-x,50%) var(--warm-y,46%), ${warmColor} 0%, transparent var(--warm-r,52%))`,
    `radial-gradient(circle at var(--amb-x,50%) var(--amb-y,46%), ${ambColor} 0%, transparent var(--amb-r,66%))`,
    `radial-gradient(circle at 50% 50%, ${baseCenter} 0%, ${baseTok} 58%, ${rimColor} 100%)`,
  ].join(", ");
  // A: pulse visibility — slightly thicker stroke + higher peak opacity (1-shot kept).
  const pulseRing = Math.max(2, Math.round(size * (A_PULSE_VISIBLE ? 0.018 : 0.012)));
  const pulsePeak = A_PULSE_VISIBLE ? 0.3 : 0.22;

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
        ["--give-scale" as string]: "1",
        ["--give-dark" as string]: "0",
      }}
    >
      {/* Body — the sphere IS the volumetric field: ONE element, five stacked
          radial-gradients, no child layer, no transform, no blur. Diagonal
          stays a true circle. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: orbBody,
          // B: uniform scale on the body (the clipped circle itself) → squircle-safe.
          // rim shadow deepens slightly during the give (pressed-material cue).
          transform: "scale(var(--give-scale, 1))",
          boxShadow: `inset 0 0 calc(${Math.round(size * 0.16)}px + var(--give-dark, 0) * ${Math.round(size * 0.05)}px) color-mix(in srgb, black 32%, transparent)`,
        }}
      />

      {/* Reaction pulse — SEPARATE layer (allowed transform/blur), concentric
          from centre, 1-shot per arrival, removed on completion. */}
      {pulses.map((id) => (
        <motion.span
          key={id}
          aria-hidden
          initial={{ scale: 1, opacity: pulsePeak }}
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
