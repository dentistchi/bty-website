"use client";

/**
 * OrbLiving — DEV-ONLY living-presence exploration. Phase A of
 * docs/ORB_LIVING_PRESENCE_SPEC.md (canon commit a9b51b8). Rendered ONLY by
 * /[locale]/dev/orb.
 *
 * ── Shared-component rule (보강 1) ────────────────────────────────────────────
 * This is a SEPARATE component from the production `Orb.tsx` (shared by /start
 * and /today). Per the dispatch, production Orb.tsx is NOT modified; all Phase A
 * work lives here, dev-only.
 *
 * ── Phase A scope ONLY ───────────────────────────────────────────────────────
 * idle breathing · micro imperfection · subtle internal particle circulation ·
 * living presence BEFORE any touch. NOT implemented here (later phases):
 * touch gravity, on-touch core drift, release memory, approach/hover detection,
 * new haptics, WebGL. This component makes ZERO haptic calls — the #배타성 LOCK
 * (haptic exclusivity, sole site in Orb.tsx) is untouched.
 *
 * ── Colour (보강 4) ──────────────────────────────────────────────────────────
 * Derived at runtime from the --bty-orb-* tokens via getComputedStyle. No new
 * colour literals. Token-value fallbacks mirror globals.css and are marked.
 *
 * ── Rendering ────────────────────────────────────────────────────────────────
 * Canvas 2D. One offscreen soft sprite is pre-rendered once, then drawImage per
 * particle (no per-frame gradient/shadowBlur allocation) → holds the 60fps gate.
 * DPR capped at 2; loop pauses while the tab is hidden (battery).
 */

import React from "react";

type RGB = { r: number; g: number; b: number };

// Fallbacks MIRROR globals.css --bty-orb-* token values — used only if
// getComputedStyle returns empty (SSR/edge). NOT new colours.
const TOKEN_FALLBACK = {
  morning: "#BD8348", // mirrors --bty-orb-morning
  touch: "#E3A25A", // mirrors --bty-orb-touch
};

function parseHex(hex: string): RGB | null {
  const m = hex.trim().replace(/^#/, "");
  if (m.length !== 6) return null;
  const n = parseInt(m, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function readToken(name: string, fallback: string): RGB {
  let raw = "";
  if (typeof window !== "undefined") {
    raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  }
  return parseHex(raw) ?? parseHex(fallback)!;
}

const rgba = (c: RGB, a: number) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

type Particle = {
  angle: number; // orbital position
  radius: number; // base distance from centre (fraction of orbR)
  angVel: number; // angular velocity — slow, signed → circulation, not a spin
  radAmp: number; // radial drift amplitude (fraction)
  radFreq: number; // radial drift frequency
  radPhase: number; // per-particle phase offset (micro imperfection)
  size: number; // sprite scale
  alpha: number; // base alpha (kept low → inner light, not sparkles)
  twFreq: number; // slow alpha-breathing frequency
  twPhase: number;
};

export interface OrbLivingProps {
  /** Pixel diameter. Default 220. */
  size?: number;
  /** Particle count (clamped to the 60–120 performance gate). Default 90. */
  particleCount?: number;
}

/**
 * Idle living-presence orb (Phase A). No pointer handlers — it does not react to
 * touch by design; it only exists, quietly alive.
 */
export default function OrbLiving({
  size = 220,
  particleCount = 90,
}: OrbLivingProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2
    );
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const reduceMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const morning = readToken("--bty-orb-morning", TOKEN_FALLBACK.morning);
    const touch = readToken("--bty-orb-touch", TOKEN_FALLBACK.touch);

    const cx = size / 2;
    const cy = size / 2;
    const orbR = size * 0.42; // body radius (soft-edge margin left over)

    const count = Math.max(60, Math.min(120, Math.round(particleCount)));

    // Pre-render ONE soft warm sprite (offscreen) → cheap drawImage per particle.
    const spriteR = 8;
    const sprite = document.createElement("canvas");
    sprite.width = spriteR * 2;
    sprite.height = spriteR * 2;
    const sctx = sprite.getContext("2d");
    if (!sctx) return;
    const sg = sctx.createRadialGradient(
      spriteR,
      spriteR,
      0,
      spriteR,
      spriteR,
      spriteR
    );
    sg.addColorStop(0, rgba(touch, 0.9));
    sg.addColorStop(0.4, rgba(touch, 0.35));
    sg.addColorStop(1, rgba(touch, 0));
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, spriteR * 2, spriteR * 2);

    // Randomized field — no two particles share timing (micro imperfection, no
    // synchronized motion). sqrt(radius) → even areal spread; mixed angVel sign
    // → circulation rather than a rigid rotation.
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const particles: Particle[] = Array.from({ length: count }, () => ({
      angle: rand(0, Math.PI * 2),
      radius: Math.sqrt(Math.random()) * 0.82,
      angVel: rand(0.02, 0.09) * (Math.random() < 0.5 ? -1 : 1),
      radAmp: rand(0.02, 0.07),
      radFreq: rand(0.15, 0.5),
      radPhase: rand(0, Math.PI * 2),
      size: rand(0.5, 1.7),
      alpha: rand(0.04, 0.2),
      twFreq: rand(0.2, 0.7),
      twPhase: rand(0, Math.PI * 2),
    }));

    let raf = 0;
    let last = 0;
    let t = 0; // accumulated seconds (survives tab-pause without a visual jump)

    const draw = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); // clamp resume gaps
      last = ts;
      t += reduceMotion ? dt * 0.4 : dt;

      // ── Phase-lag propagation (order of motion, NOT amount) ─────────────────
      // ONE shared heartbeat originates at the core; each outer layer reads the
      // SAME beat at an increasing TIME LAG, so motion propagates outward:
      // core (leads, t) → surrounding light (responds, t−LAG_MID) → shell
      // (follows, t−LAG_SHELL) → settles. Amplitude DECREASES outward (a
      // heartbeat under skin, not a balloon). Per-layer micro-imperfection sines
      // at different freqs keep the layers from being synchronized copies.
      //
      // Biological rhythm (NOT randomness): a perfect period reads as dead, so the
      // beat is only a sine in the limit. Its PHASE is slow-frequency-modulated —
      // tempo drifts so no two breaths share a period (dφ/dt stays > 0 → never
      // reverses). Its DEPTH is slow-amplitude-modulated within [0.72, 1.0], where
      // 1.0 == the prior max: depth only ever REDUCES (rest breaths) and never
      // exceeds prior amplitude. Both modulators are deterministic incommensurate
      // sines → non-repeating, NO Math.random, no per-frame jitter, variation
      // below the conscious threshold ("rest… awaken… deep breath").
      const beat = (tt: number) => {
        const phase =
          tt * 0.5 + 0.6 * Math.sin(tt * 0.11) + 0.3 * Math.sin(tt * 0.047 + 1.2);
        // Depth — biological rest/deep-breath variation, ∈ [0.72, 1.0].
        const depthBase = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(tt * 0.067 + 0.5));
        // Settling pause — RARE + brief. A sparse narrow dip from a slow, high-
        // power deterministic sine (fires ≈ once per ~78s): eases depth down to
        // ~0.2× so the breath SETTLES into near-stillness, then the same smooth
        // envelope brings it back. C1-continuous (max()/pow slope is 0 at the
        // seam) → no waveform discontinuity, no freeze. The phase keeps advancing
        // and the ember wander / micro-imperfection / particles keep moving, so no
        // frame stops mid-air — stillness is a SINKING, not a stop. This dip is the
        // sole gate on pause occurrence.
        const settle = 1 - 0.8 * Math.pow(Math.max(0, Math.sin(tt * 0.08 + 1.7)), 16);
        return depthBase * settle * Math.sin(phase);
      };
      const LAG_MID = 0.6; // s — surrounding light lags the core
      const LAG_SHELL = 1.3; // s — shell lags last

      // Core LEADS — off-centre asymmetric wander (unchanged), strongest pulse.
      const wanderX = Math.sin(t * 0.23) * 0.62 + Math.sin(t * 0.37 + 1.3) * 0.38;
      const wanderY = Math.cos(t * 0.19 + 0.5) * 0.55 + Math.sin(t * 0.41 + 2.1) * 0.3;
      const coreAmp = size * 0.055;
      const ecx = cx + wanderX * coreAmp;
      const ecy = cy + wanderY * coreAmp * 0.78; // less vertical travel → asymmetry
      const corePulse = 1 + 0.1 * beat(t) + 0.02 * Math.sin(t * 0.71 + 0.9);
      const coreR = orbR * 0.46 * corePulse;
      const coreDens = 0.85 + 0.15 * beat(t); // brightness leads with the beat

      // Surrounding light RESPONDS — mid radius, beat lagged by LAG_MID, smaller
      // amplitude, centre leaning back toward the middle (wanders less than core).
      const midPulse = 1 + 0.05 * beat(t - LAG_MID) + 0.015 * Math.sin(t * 0.63 + 2.0);
      const midR = orbR * 0.72 * midPulse;
      const midDens = 0.85 + 0.15 * beat(t - LAG_MID);
      const mcx = cx * 0.7 + ecx * 0.3;
      const mcy = cy * 0.7 + ecy * 0.3;

      // Outer shell FOLLOWS last — widest, beat lagged most, barely moves (skin).
      const shellPulse = 1 + 0.007 * beat(t - LAG_SHELL);
      const bcx = cx + Math.sin(t * 0.13) * (size * 0.005);
      const bcy = cy + Math.cos(t * 0.11 + 0.6) * (size * 0.005);
      const shellR = orbR * shellPulse;

      ctx.clearRect(0, 0, size, size);

      // (1) Outer shell — wide, dim, flat; follows the beat a full lag behind.
      const bg = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, shellR);
      bg.addColorStop(0, rgba(morning, 0.13));
      bg.addColorStop(0.55, rgba(morning, 0.1));
      bg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bcx, bcy, shellR, 0, Math.PI * 2);
      ctx.fill();

      // (2) Surrounding light — responds to the core, LAG_MID behind. Additive.
      ctx.globalCompositeOperation = "lighter";
      const mg = ctx.createRadialGradient(mcx, mcy, 0, mcx, mcy, midR);
      mg.addColorStop(0, rgba(morning, 0.16 * midDens));
      mg.addColorStop(0.5, rgba(morning, 0.09 * midDens));
      mg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mcx, mcy, midR, 0, Math.PI * 2);
      ctx.fill();

      // (3) Ember core — bright, dense, OFF-CENTRE, LEADS. Glows from within.
      const cg = ctx.createRadialGradient(ecx, ecy, 0, ecx, ecy, coreR);
      cg.addColorStop(0, rgba(touch, 0.46 * coreDens));
      cg.addColorStop(0.32, rgba(touch, 0.22 * coreDens));
      cg.addColorStop(0.7, rgba(morning, 0.07));
      cg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(ecx, ecy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // (4) Heart — small dense point at the core, irregular flicker (micro
      // imperfection: "life exists inside imperfection"). Leads with the beat.
      const heartR = orbR * 0.16 * (1 + 0.12 * beat(t));
      const heartA = 0.18 + 0.07 * Math.sin(t * 0.9) + 0.04 * Math.sin(t * 1.7 + 1.1);
      const hg = ctx.createRadialGradient(ecx, ecy, 0, ecx, ecy, heartR);
      hg.addColorStop(0, rgba(touch, Math.max(0, heartA)));
      hg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(ecx, ecy, heartR, 0, Math.PI * 2);
      ctx.fill();

      // (5) Internal circulation — particles orbit the WANDERING core, radius
      // scaled to the shell. Faint and slow; count/amplitude unchanged.
      const ccx = bcx * 0.4 + ecx * 0.6;
      const ccy = bcy * 0.4 + ecy * 0.6;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const ang = p.angle + p.angVel * t;
        const rOsc = p.radius + Math.sin(t * p.radFreq + p.radPhase) * p.radAmp;
        const rr = Math.max(0, Math.min(0.92, rOsc)) * shellR;
        const px = ccx + Math.cos(ang) * rr;
        const py = ccy + Math.sin(ang) * rr;
        // Fade toward the rim → reads as INTERNAL light, not edge sparkles.
        const rimFade = 1 - Math.min(1, rr / shellR / 0.95);
        const tw = 0.6 + 0.4 * Math.sin(t * p.twFreq + p.twPhase);
        const a = p.alpha * tw * (0.35 + 0.65 * rimFade);
        if (a <= 0.002) continue;
        const s = p.size;
        ctx.globalAlpha = a;
        ctx.drawImage(
          sprite,
          px - s * spriteR * 0.5,
          py - s * spriteR * 0.5,
          s * spriteR,
          s * spriteR
        );
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      raf = window.requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0; // fresh dt → no jump
        raf = window.requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = window.requestAnimationFrame(draw);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [size, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ width: size, height: size, display: "block", touchAction: "none" }}
    />
  );
}
