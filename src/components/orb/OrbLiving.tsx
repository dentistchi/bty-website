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
 * ── Scope: Phase A idle presence + B-1/B-1.5 pointer notice ───────────────────
 * idle breathing · micro imperfection · subtle internal particle circulation ·
 * living presence before touch, PLUS B-1/B-1.5 pointer notice→attention→core
 * drift→stabilize (the pointer supplies the touch coordinate/time only; the
 * reaction path is deterministic). Still deferred (later phases): full touch
 * gravity, release memory, approach/hover detection, WebGL, and ANY haptic. This
 * component makes ZERO haptic calls — the #배타성 LOCK (haptic exclusivity, sole
 * site in Orb.tsx) is untouched.
 *
 * ── Colour (보강 4) ──────────────────────────────────────────────────────────
 * Derived at runtime from the --bty-orb-* tokens via getComputedStyle. No new
 * colour literals. Token-value fallbacks mirror globals.css and are marked.
 *
 * ── Rendering ────────────────────────────────────────────────────────────────
 * Canvas 2D. Body/core/heart plus a luminous MEDIUM (many large, soft, low-peak
 * overlapping lobes that read as one continuous light field, not particles) are all
 * radial-gradient FILLS under globalCompositeOperation 'lighter' → every element
 * only ADDS light (never darkens what is beneath — no dust/dirt; Safari composited
 * the old drawImage sprite as source-over). DPR capped at 2; loop pauses while the
 * tab is hidden (battery).
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

// A cell of the luminous MEDIUM (not a particle). A large, soft, low-peak additive
// lobe; heavy overlap of many cells sums into a CONTINUOUS light field where local
// density fluctuations occasionally become visible. The cell is not an entity — it
// is a brief moment where the living light becomes perceptible.
type MediumCell = {
  angle: number; // orbital drift position
  radius: number; // base distance from centre (fraction of orbR)
  angVel: number; // slow signed drift
  radAmp: number; // radial drift amplitude (fraction)
  radFreq: number; // radial drift frequency
  radPhase: number; // per-cell phase offset (no synchronized motion)
  lobe: number; // soft lobe radius (× orbR) — LARGE → overlaps into a field
  peak: number; // low peak alpha (mostly SUB-visible)
  densFreq: number; // slow visibility fluctuation (density leads, not brightness)
  densPhase: number;
  densPow: number; // dissolve sharpness — tier-specific (gentle → sparse)
  floor: number; // visibility floor — tier A stays near peak; tier C floors to 0
};

export interface OrbLivingProps {
  /** Pixel diameter. Default 220. */
  size?: number;
  /** Luminous-medium cell count (clamped 24–64). Default 40 — presence, not a number. */
  fieldCells?: number;
}

/**
 * Living-presence orb — Phase A idle presence + B-1/B-1.5 pointer notice. Pointer
 * input supplies the touch coordinate/time only; the reaction path is deterministic
 * and haptic-free. Production-safety: reduced-motion → a single static frame (no
 * autonomous motion); canvas-unavailable → a static CSS-gradient presence fallback
 * (never blank).
 */
export default function OrbLiving({
  size = 220,
  fieldCells = 40,
}: OrbLivingProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFailed(true); // canvas unavailable → static CSS-gradient presence fallback
      return;
    }

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

    const CELLS = Math.max(24, Math.min(64, Math.round(fieldCells)));

    // ── Tiered visibility (Commander): the Orb contains living LIGHT, not
    // particles. ~86% pure medium (sub-visible, never crests — the light itself) /
    // ~11% faint edgeless swell / ~3% rare brief emergence that dissolves FAST.
    // Size, peak, dissolve sharpness, and drift ALL differ by tier (no uniform
    // cells) → at most ~1 diffuse crest is ever perceptible; the eye cannot count.
    // Tier thresholds 0.863 / 0.971 double as this rework's chunk-freshness marker.
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const makeCell = (): MediumCell => {
      const roll = Math.random();
      let lobe: number, peak: number, densFreq: number, densPow: number;
      let floor: number, drift: number;
      if (roll < 0.863) {
        // TIER A — pure medium: the continuous light. Never crests. Largest, most
        // diffuse, very dim, near-constant → overlap sums to a smooth living field.
        lobe = rand(0.2, 0.34);
        peak = rand(0.004, 0.007);
        densFreq = rand(0.02, 0.06);
        densPow = 1;
        floor = 0.72;
        drift = rand(0.008, 0.02);
      } else if (roll < 0.971) {
        // TIER B — faint swell: occasionally a faint, edgeless density bump.
        lobe = rand(0.16, 0.26);
        peak = rand(0.012, 0.019);
        densFreq = rand(0.045, 0.1);
        densPow = 3;
        floor = 0.12;
        drift = rand(0.01, 0.024);
      } else {
        // TIER C — emergence: rare, brief, illusion-level; dissolves FAST into the
        // medium; slowest drift + soft → cannot be tracked; ≤1 visible at a time.
        lobe = rand(0.11, 0.17);
        peak = rand(0.02, 0.03);
        densFreq = rand(0.05, 0.12);
        densPow = 6;
        floor = 0;
        drift = rand(0.006, 0.014);
      }
      return {
        angle: rand(0, Math.PI * 2),
        radius: Math.sqrt(Math.random()) * 0.72,
        angVel: drift * (Math.random() < 0.5 ? -1 : 1),
        radAmp: rand(0.03, 0.1),
        radFreq: rand(0.05, 0.18),
        radPhase: rand(0, Math.PI * 2),
        lobe,
        peak,
        densFreq,
        densPhase: rand(0, Math.PI * 2),
        densPow,
        floor,
      };
    };
    const cells: MediumCell[] = Array.from({ length: CELLS }, makeCell);

    // ── B-1 tuning knobs (Sensory Gate round) ──────────────────────────────────
    const NOTICE_S = 0.08; // 60–100ms notice delay before attention begins (§B)
    const MAX_DRIFT = orbR * 0.55; // core stays interior; cap on drift toward touch
    const SLOW_SPEED = 220; // px/s — above = ignore (no pursuit); below = retarget
    const TAU_SEED = 0.42; // s — Seed (life origin) leads the core slightly (~0ms)
    const TAU_CORE = 0.55; // s — Attention Core drift ease (~40ms) — B-1, PRESERVED
    const TAU_MID = 0.9; // s — mid glow (part of core body) follows core
    const TAU_FIELD = 1.05; // s — Energy Field follows the CORE (not finger) (~120ms)
    const FIELD_AMP = 0.55; // Energy Field reduced amplitude (damped cohesion, no chase)
    const TAU_SHELL = 1.4; // s — Shell follows the field last, weakest (~180ms)
    const TAU_ENGAGE = 0.6; // s — engage (wander-shrink / subtle brighten) ease
    const RELEASE_TAU_SCALE = 1.7; // release returns calmer (slower ease to idle)
    const WANDER_REDUCE = 0.5; // core wander radius shrinks by this ×engage on arrival
    const ENGAGE_BRIGHTEN = 0.05; // subtle "noticed" warmth (§C-5: kept minimal)

    // B-1 attention state — mutable across frames. Reaction path is deterministic;
    // only the touch COORDINATE/TIME (input) is non-deterministic.
    let realT = 0; // unscaled seconds — notice timing (independent of reduceMotion)
    let touching = false;
    let touchDownT = 0;
    let touchX = cx;
    let touchY = cy;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let lastMoveTs = 0;
    let engage = 0; // 0 idle → 1 attentive
    let seedShiftX = 0; // Seed — leads the core (life origin)
    let seedShiftY = 0;
    let coreShiftX = 0;
    let coreShiftY = 0;
    let midShiftX = 0;
    let midShiftY = 0;
    let fieldShiftX = 0; // Energy Field — follows the core, damped + reduced
    let fieldShiftY = 0;
    let shellShiftX = 0;
    let shellShiftY = 0;

    let raf = 0;
    let last = 0;
    let t = 0; // accumulated seconds (survives tab-pause without a visual jump)

    const draw = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000); // clamp resume gaps
      last = ts;
      t += reduceMotion ? dt * 0.4 : dt;

      // ── B-1 attention (Existence → Relationship) ────────────────────────────
      // Touch → Notice(delay) → Attention → Core Drift → Stabilize, + slow refresh.
      // NOTICE: `realT` is UNSCALED so the 60–100ms delay is real regardless of
      // reduceMotion. While touching-but-not-yet-noticed, nothing shifts — the
      // delay itself is the "noticing" (no visual change, §B). After notice the
      // core eases toward the (clamped) touch point; mid then shell follow with
      // longer time-constants (core-first, §C-2). RELEASE: target → idle and every
      // layer eases calmly back (no linger — that is B-3). Particles never receive
      // this shift (§D-3). All easing is exponential-toward-target → no snap.
      realT += dt;
      const noticed = touching && realT - touchDownT >= NOTICE_S;
      let tsx = 0;
      let tsy = 0;
      if (noticed) {
        tsx = touchX - cx;
        tsy = touchY - cy;
        const m = Math.hypot(tsx, tsy);
        if (m > MAX_DRIFT) {
          tsx = (tsx / m) * MAX_DRIFT;
          tsy = (tsy / m) * MAX_DRIFT;
        }
      }
      // Layer cascade (§C-2 order, B-1.5): Seed → Attention Core → Energy Field →
      // Shell. Each follows the PREVIOUS layer (never the finger) with a longer
      // time-constant → one body flexing inward-to-outward, not separate circles.
      // The Field follows the CORE (damped, reduced amplitude) — this is what keeps
      // the medium attached to the core during drift (no core-medium separation),
      // while still honouring No-Chase (§D-4): the field never targets the finger.
      const rel = noticed ? 1 : RELEASE_TAU_SCALE; // calmer return on release
      const kSeed = 1 - Math.exp(-dt / (TAU_SEED * rel));
      const kCore = 1 - Math.exp(-dt / (TAU_CORE * rel));
      const kMid = 1 - Math.exp(-dt / (TAU_MID * rel));
      const kField = 1 - Math.exp(-dt / (TAU_FIELD * rel));
      const kShell = 1 - Math.exp(-dt / (TAU_SHELL * rel));
      engage += ((noticed ? 1 : 0) - engage) * (1 - Math.exp(-dt / (TAU_ENGAGE * rel)));
      seedShiftX += (tsx - seedShiftX) * kSeed; // Seed leads (fastest → ~0ms)
      seedShiftY += (tsy - seedShiftY) * kSeed;
      coreShiftX += (tsx - coreShiftX) * kCore; // Attention Core (B-1, PRESERVED)
      coreShiftY += (tsy - coreShiftY) * kCore;
      midShiftX += (coreShiftX - midShiftX) * kMid; // mid glow follows the core body
      midShiftY += (coreShiftY - midShiftY) * kMid;
      fieldShiftX += (coreShiftX * FIELD_AMP - fieldShiftX) * kField; // Field ← CORE, damped
      fieldShiftY += (coreShiftY * FIELD_AMP - fieldShiftY) * kField;
      shellShiftX += (fieldShiftX - shellShiftX) * kShell; // Shell follows field, last
      shellShiftY += (fieldShiftY - shellShiftY) * kShell;

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
      // Idle (Phase A) wander bases — FULL amplitude, shift-free. Particles and the
      // untouched path reference these → untouched output is byte-identical to
      // Phase A (engage=0 → ×1.0, all shifts 0 → +0.0, both exact in IEEE-754).
      const exIdle = cx + wanderX * coreAmp;
      const eyIdle = cy + wanderY * coreAmp * 0.78;
      const bxIdle = cx + Math.sin(t * 0.13) * (size * 0.005);
      const byIdle = cy + Math.cos(t * 0.11 + 0.6) * (size * 0.005);
      // Attention applied: core wander shrinks as attention settles (wr=1 idle) and
      // the lagged shift moves the RENDERED centres (core leads → mid → shell).
      const wr = 1 - WANDER_REDUCE * engage;
      const exBase = cx + wanderX * coreAmp * wr;
      const eyBase = cy + wanderY * coreAmp * 0.78 * wr;
      const ecx = exBase + coreShiftX;
      const ecy = eyBase + coreShiftY;
      const corePulse = 1 + 0.1 * beat(t) + 0.02 * Math.sin(t * 0.71 + 0.9);
      const coreR = orbR * 0.46 * corePulse;
      const coreDens = (0.85 + 0.15 * beat(t)) * (1 + ENGAGE_BRIGHTEN * engage);

      // Surrounding light RESPONDS — mid radius, beat lagged by LAG_MID, smaller
      // amplitude, centre leaning back toward the middle (wanders less than core).
      const midPulse = 1 + 0.05 * beat(t - LAG_MID) + 0.015 * Math.sin(t * 0.63 + 2.0);
      const midR = orbR * 0.72 * midPulse;
      const midDens = 0.85 + 0.15 * beat(t - LAG_MID);
      const mcx = cx * 0.7 + exBase * 0.3 + midShiftX;
      const mcy = cy * 0.7 + eyBase * 0.3 + midShiftY;

      // Outer shell FOLLOWS last — widest, beat lagged most, barely moves (skin).
      const shellPulse = 1 + 0.007 * beat(t - LAG_SHELL);
      const bcx = bxIdle + shellShiftX;
      const bcy = byIdle + shellShiftY;
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

      // (4) Seed — the life origin: a small, faint inner point that LEADS the core
      // (seedShift eases fastest → moves first, ~0ms). Irregular flicker (micro
      // imperfection: "life exists inside imperfection"). Kept near-invisible and
      // folded into the core, so no new circle is read — it only makes the core
      // feel like it has a deeper, first-moving heart. Same alpha/size as before →
      // no added brightness.
      const seedX = exBase + seedShiftX;
      const seedY = eyBase + seedShiftY;
      const heartR = orbR * 0.16 * (1 + 0.12 * beat(t));
      const heartA = 0.18 + 0.07 * Math.sin(t * 0.9) + 0.04 * Math.sin(t * 1.7 + 1.1);
      const hg = ctx.createRadialGradient(seedX, seedY, 0, seedX, seedY, heartR);
      hg.addColorStop(0, rgba(touch, Math.max(0, heartA)));
      hg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(seedX, seedY, heartR, 0, Math.PI * 2);
      ctx.fill();

      // (5) Luminous MEDIUM (was discrete particles). Each cell is a LARGE, very
      // soft, low-peak additive lobe; heavy overlap sums into a CONTINUOUS light
      // field, so the eye reads breathing light — not dots. Density (not
      // brightness) leads: a cell dwells SUB-visible and only occasionally crests
      // above the visibility threshold (~10–20% at any moment), then dissolves back
      // into the field (fade = dissolution, not on/off). Additive 'lighter' → only
      // ever ADDS warm light, can never darken (no dust). Touch-UNRESPONSIVE (§D-3):
      // orbits the IDLE centre, receives no attention shift.
      // Energy Field follows the Attention Core (via fieldShift — delayed, damped,
      // reduced amplitude): the medium moves WITH the core during drift → one
      // cohesive body, no leftover dots. Still touch-UNRESPONSIVE to the finger
      // itself (§D-3 / No-Chase §D-4): the shift comes ONLY from the core layer,
      // never from the touch point.
      const ccx = bxIdle * 0.4 + exIdle * 0.6 + fieldShiftX;
      const ccy = byIdle * 0.4 + eyIdle * 0.6 + fieldShiftY;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]!;
        const ang = c.angle + c.angVel * t;
        const rOsc = c.radius + Math.sin(t * c.radFreq + c.radPhase) * c.radAmp;
        const rr = Math.max(0, Math.min(0.85, rOsc)) * shellR;
        const px = ccx + Math.cos(ang) * rr;
        const py = ccy + Math.sin(ang) * rr;
        // Density fluctuation — tier-specific: tier A undulates near its floor
        // (never crests); tier C floors to 0 and rarely spikes then dissolves fast.
        const dens =
          c.floor +
          (1 - c.floor) * Math.pow(0.5 + 0.5 * Math.sin(t * c.densFreq + c.densPhase), c.densPow);
        // Dissolve toward the rim so the medium fades into the field, no hard edge.
        const rimFade = 1 - Math.min(1, rr / shellR / 0.95);
        const a = c.peak * dens * (0.4 + 0.6 * rimFade);
        if (a <= 0.0012) continue; // truly sub-visible → skip (perf)
        const R = c.lobe * orbR; // large soft lobe (overlaps neighbours)
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, rgba(touch, a));
        g.addColorStop(0.5, rgba(touch, a * 0.35)); // very gradual → soft, edgeless
        g.addColorStop(1, rgba(morning, 0)); // dissolves into transparent field
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Reduced-motion: draw exactly ONE static frame — no autonomous motion for
      // vestibular sensitivity. Otherwise keep the living loop.
      if (!reduceMotion) raf = window.requestAnimationFrame(draw);
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

    // ── B-1 pointer input (touch coordinate = input; reaction stays deterministic).
    const localPoint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onPointerDown = (e: PointerEvent) => {
      const p = localPoint(e);
      touching = true;
      touchDownT = realT; // notice delay starts now
      touchX = p.x;
      touchY = p.y;
      lastMoveX = p.x;
      lastMoveY = p.y;
      lastMoveTs = e.timeStamp;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!touching) return;
      const p = localPoint(e);
      const dtMs = Math.max(1, e.timeStamp - lastMoveTs);
      const dist = Math.hypot(p.x - lastMoveX, p.y - lastMoveY);
      const speed = (dist / dtMs) * 1000; // px/s (input-derived)
      lastMoveX = p.x;
      lastMoveY = p.y;
      lastMoveTs = e.timeStamp;
      // Attention Refresh (§D-5 / No Pursuit §D-4): fast motion → IGNORE (no
      // cursor-follow); slow intention → retarget the drift GOAL only. The slow
      // ease does the realignment — this is not per-frame following.
      if (speed <= SLOW_SPEED) {
        touchX = p.x;
        touchY = p.y;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      touching = false; // → drift eases back to idle (calm return, no linger)
      canvas.releasePointerCapture?.(e.pointerId);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [size, fieldCells]);

  return (
    <div aria-hidden style={{ position: "relative", width: size, height: size }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          width: size,
          height: size,
          display: failed ? "none" : "block",
          touchAction: "none",
        }}
      />
      {failed ? (
        // Static presence fallback (canvas unavailable). Colours mirror the
        // --bty-orb-* token fallbacks; static → also reduced-motion safe.
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 45%, rgba(227,162,90,0.55), rgba(189,131,72,0.35) 45%, rgba(189,131,72,0) 72%)",
          }}
        />
      ) : null}
    </div>
  );
}
