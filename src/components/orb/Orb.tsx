"use client";

/**
 * Orb — Product A · Spine v1 presentation primitive (P0b · v3.10, light-breathing).
 *
 * Model: warm light spread through translucent matter; touch is a gravity well at
 * the fingertip that GATHERS density toward it (weighted, accelerating). The orb
 * is ALIVE from within — at rest the inner light drifts and pulses irregularly
 * (not the outer boundary, which is fixed). One progress value `g` (0→1) drives
 * gather + fill + near-side brightness.
 *
 * ── HARD CONSTRAINT (squircle/UI-regression guard, highest priority) ─────────
 * - NO particles/dots as real elements — density via gradients only.
 * - All inner light = comma-stacked radial-gradient(circle …) (≤5) on the body
 *   element's SINGLE background. NO child light layer, NO transform on the light,
 *   NO filter:blur on the light. Softness = wide stop spreads, never blur.
 * - body: border-radius:50%; overflow:hidden; NO transform (boundary fixed).
 *   Every gradient uses 'circle'.
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
import { isNative } from "@/lib/native/isNative";

export type OrbMode = "morning" | "evening";

export interface OrbProps {
  /** Time-of-ritual mode — drives baseline colour from the P0a tokens. */
  mode: OrbMode;
  /** Fired on a completed contact arrival (press / keyboard activate). */
  onTouch?: () => void;
  /**
   * Fired ONCE when the gather saturates past {@link COMMIT_G} during a single
   * press (hold-to-commit). Observes the existing `g` only — does NOT alter the
   * gather/settle curve and adds no haptic. Release before commit never fires;
   * held past commit does not re-fire (latched per press).
   */
  onCommit?: () => void;
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

// Hold-to-commit threshold on the gather value `g`. The gather self-accelerates
// (exponential) and hard-clamps to 1.0 at ~2.4s of hold; 0.97 fires within ~1
// frame of full saturation (Commander-locked intention-weight ≈ 2.4s hold).
// OBSERVED only — this does NOT change the gather/settle animation curve.
const COMMIT_G = 0.97;

/**
 * Pure commit decision — rising-edge: true only when the gather has saturated
 * past {@link COMMIT_G} and this press has not yet committed. Extracted for unit
 * test; observes state, never mutates the curve.
 */
export function shouldCommit(g: number, committed: boolean, commitG: number = COMMIT_G): boolean {
  return !committed && g >= commitG;
}

/** The sole sanctioned haptic call site in the entire app (#배타성 LOCK). */
function triggerOrbHaptic(): void {
  if (typeof navigator === "undefined") return;
  // Native (iOS WKWebView): web Vibration API is dead → route the morning pulse
  // through Capacitor Haptics impact(Light). Still the SOLE haptic site (#배타성
  // LOCK) — this is a platform branch, not a second call site.
  if (isNative()) {
    window.Capacitor?.Plugins?.Haptics?.impact?.({ style: "LIGHT" });
    return;
  }
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
const FLOW_MAX = 5.5; // ≈ radius(50) * 0.11 — slow circulation amplitude (trackable A→B flow)
// Heartbeat: rare, irregular, localized swell — "something pulsed once inside".
const HB_DUR_MS = 1500;
const HB_MIN_MS = 6000;
const HB_MAX_MS = 12000;
const HB_SIZE = 11; // warm-r bump during a beat (restrained, < gather)

// Weighted gather: g self-accelerates (slow → fast) while held, caps at 1.
const GATHER_K = 0.85;
const GATHER_BASE = 0.15;
const TRAIL_LERP = 0.06;
const OFFSET_LERP = 0.2;
const RELEASE_BASE_MS = 1300;
const RELEASE_SCALE_MS = 2200;
const ONSET_MS = 70;

const A_PULSE_VISIBLE = true; // pulse visibility (v3.7) — kept

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
  onCommit,
  size = 200,
  enableHaptic = true,
  ariaLabel,
}: OrbProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Latest-ref for onCommit — the rAF loop below mounts once ([] deps) and would
  // otherwise close over a stale handler. Synced every render.
  const onCommitRef = React.useRef(onCommit);
  React.useEffect(() => {
    onCommitRef.current = onCommit;
  });
  // Once-per-press commit latch (reset in beginPress). Held-past-commit keeps g
  // pinned at 1.0 across many frames → latch guarantees a single fire.
  const committedRef = React.useRef(false);
  const targetOffRef = React.useRef({ x: 0, y: 0 });
  const dispOffRef = React.useRef({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef(0);

  const pressedRef = React.useRef(false);
  const pressTsRef = React.useRef(0);
  const gRef = React.useRef(0);
  const gTrailRef = React.useRef(0);
  const releaseRef = React.useRef<ReleaseState>({ active: false, from: 0, startTs: 0, settleMs: 0 });
  const hbStartRef = React.useRef(-1); // heartbeat: active swell start (-1 = none)
  const hbNextRef = React.useRef(0); // heartbeat: scheduled next-beat timestamp

  const [pulses, setPulses] = React.useState<number[]>([]);
  const pulseSeq = React.useRef(0);

  const baseTok = baseTokenFor(mode);
  const coreColor = alpha(lighten(baseTok, 18), 52); // v3.13: core slightly denser (wide kept)
  const warmColor = alpha(lighten(baseTok, 16), 74);
  const ambColor = alpha(lighten(baseTok, 7), 38);
  const touchColor = alpha(lighten(baseTok, 24), 66);
  const baseCenter = lighten(baseTok, 8);
  const rimMid = darken(baseTok, 26); // v3.13: intermediate dark in the outer band
  const rimColor = darken(baseTok, 55); // v3.13: deeper edge (was 38) → volumetric, filled
  const pulseColor = lighten(baseTok, 40);

  React.useEffect(() => {
    const tick = () => {
      const t = now();
      let dt = lastTsRef.current ? (t - lastTsRef.current) / 1000 : 0.016;
      lastTsRef.current = t;
      if (dt > 0.05) dt = 0.05;

      const off = dispOffRef.current;
      const tgt = targetOffRef.current;
      off.x += (tgt.x - off.x) * OFFSET_LERP;
      off.y += (tgt.y - off.y) * OFFSET_LERP;

      let g = gRef.current;
      if (pressedRef.current) {
        if (t - pressTsRef.current >= ONSET_MS) {
          g += dt * GATHER_K * (GATHER_BASE + g);
          if (g > 1) g = 1;
          // Commit detection — OBSERVES g only (no curve mutation, no haptic).
          if (shouldCommit(g, committedRef.current, COMMIT_G)) {
            committedRef.current = true;
            onCommitRef.current?.();
          }
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
      gTrailRef.current += (g - gTrailRef.current) * TRAIL_LERP;
      const gTrail = gTrailRef.current;

      // v3.10 — LIFE lives in the light, not the boundary. Irregular (multi-sine)
      // drift of the inner light + slow irregular brightness pulse. At idle this is
      // the only motion; on touch the gather overpowers the drift.
      // v3.12 — directional CIRCULATION: each layer's center travels a slow Lissajous
      // path (incommensurate periods → non-repeating, trackable A→B). Core ~fixed
      // (centre of mass); Warm/Ambient circulate. Gather (on touch) adds on top.
      const s = (p: number, ph: number): number => Math.sin((t / p) * Math.PI * 2 + ph);
      const flowX: Record<LayerKey, number> = {
        core: FLOW_MAX * 0.15 * s(19000, 0),
        warm: FLOW_MAX * s(13000, 0),
        amb: FLOW_MAX * s(15000, 2.0),
        touch: 0,
      };
      const flowY: Record<LayerKey, number> = {
        core: FLOW_MAX * 0.15 * s(23000, 1.0),
        warm: FLOW_MAX * s(17000, 1.3),
        amb: FLOW_MAX * s(11000, 0.5),
        touch: 0,
      };
      const breath = s(6300, 1.1); // uniform pulse demoted to auxiliary

      // heartbeat: rare, irregular, localized swell — one beat then schedule the next.
      if (hbNextRef.current === 0) hbNextRef.current = t + 4000;
      if (hbStartRef.current < 0 && t >= hbNextRef.current) hbStartRef.current = t;
      let hb = 0;
      if (hbStartRef.current >= 0) {
        const e = t - hbStartRef.current;
        if (e >= HB_DUR_MS) {
          hbStartRef.current = -1;
          hbNextRef.current = t + HB_MIN_MS + Math.random() * (HB_MAX_MS - HB_MIN_MS);
        } else {
          hb = Math.sin((Math.PI * e) / HB_DUR_MS); // 0→1→0 swell
        }
      }

      const el = containerRef.current;
      if (el) {
        for (const layer of LAYERS) {
          const gg = layer.useTrail ? gTrail : g;
          const cx = CENTER + flowX[layer.key] + off.x * layer.lean * gg;
          const cy = REST_Y + flowY[layer.key] + off.y * layer.lean * gg;
          el.style.setProperty(`--${layer.key}-x`, `${cx}%`);
          el.style.setProperty(`--${layer.key}-y`, `${cy}%`);
        }
        el.style.setProperty("--core-r", `${44 + g * 10 + breath * 5}%`);
        // heartbeat blooms the warm mass briefly at its current (circulating) spot.
        el.style.setProperty("--warm-r", `${52 + g * 40 + breath * 3 + hb * HB_SIZE}%`);
        el.style.setProperty("--amb-r", `${66 + g * 22}%`);
        el.style.setProperty("--touch-r", `${28 + gTrail * 30}%`);
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
      committedRef.current = false; // fresh press — re-arm the commit latch
      releaseRef.current.active = false;
      targetOffRef.current = offset;
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

  const orbBody = [
    `radial-gradient(circle at var(--touch-x,50%) var(--touch-y,46%), ${touchColor} 0%, transparent var(--touch-r,28%))`,
    `radial-gradient(circle at var(--core-x,50%) var(--core-y,46%), ${coreColor} 0%, transparent var(--core-r,44%))`,
    `radial-gradient(circle at var(--warm-x,50%) var(--warm-y,46%), ${warmColor} 0%, transparent var(--warm-r,52%))`,
    `radial-gradient(circle at var(--amb-x,50%) var(--amb-y,46%), ${ambColor} 0%, transparent var(--amb-r,66%))`,
    `radial-gradient(circle at 50% 50%, ${baseCenter} 0%, ${baseTok} 50%, ${rimMid} 78%, ${rimColor} 100%)`,
  ].join(", ");
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
      {/* Body — fixed silhouette (NO transform). The sphere IS the volumetric
          field: ONE element, five stacked radial-gradients, no child layer, no
          blur. Diagonal stays a true circle. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background: orbBody,
          // v3.13: deeper inset limb-darkening ring → rounded, filled volume (not flat).
          boxShadow: `inset 0 0 ${Math.round(size * 0.2)}px color-mix(in srgb, black 46%, transparent)`,
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
