"use client";

import { useEffect, useRef, useState } from "react";

/**
 * WeeklyOrb — a quiet, INTERACTION-FREE weekly-light presence for the native Me tab.
 *
 * It is NOT the Threshold Door. It deliberately does NOT reuse OrbLiving / Orb.tsx and
 * must never call orbHaptic() — the Haptic Exclusivity Lock keeps exactly ONE live
 * haptic site (OrbLiving on /start). This component has no pointer handlers, no tap
 * action, no navigation, no CTA, and no document.body/full-viewport canvas. It only
 * renders light on its own local canvas.
 *
 * It translates the week's numberless projection — dailyBarSeries[].barIntensity (0–5,
 * up to 7 days) — into Orb growth/light, never a chart, number, rank, or score:
 *   - mean intensity   → body size / core warmth / breath depth
 *   - active-day count → inner medium (particle) density
 *   - each day's value → one daily light whose RADIUS + brightness + warmth rise with it
 *   - today            → a gentle BLINK (living, in-progress) — not a completed ring
 *   - empty week       → a quiet RESTING orb (presence floor), never "failure"
 *
 * STEP 3 — "our days leave light / our lives shine": brighter overall; the 7 daily lights
 * orbit slowly, GATHER inward on inhale (their glow softening as if absorbed into the
 * weekly orb, which brightens to receive them) and RELEASE outward on exhale; today is a
 * soft breathing blink (no ring). All restrained — warm living light, never neon, never an
 * achievement burst. Reduced motion → a brighter STATIC orb + static daily lights (no
 * orbit / gather / blink; single repaint when data arrives).
 */

type Locale = "en" | "ko";

type Props = {
  /** Per-day visual intensity 0–5 (weekly-stats projection). Empty → resting orb. */
  intensities: number[];
  locale: Locale;
  /** Pixel diameter. Default 184. */
  size?: number;
};

type RGB = { r: number; g: number; b: number };

// Fallbacks MIRROR globals.css --bty-orb-* token values (used only if getComputedStyle
// returns empty). NOT new colours. #C9A66B is the restrained warm-gold accent.
const TOKEN_FALLBACK = { morning: "#BD8348", touch: "#E3A25A" };
const GOLD: RGB = { r: 201, g: 166, b: 107 }; // #C9A66B
const SHINE: RGB = { r: 255, g: 244, b: 224 }; // warm near-white for living node centres

const CAPTION: Record<Locale, string> = {
  en: "This week's trace",
  ko: "이번 주의 흔적",
};
const ARIA: Record<Locale, string> = {
  en: "Your rhythm this week",
  ko: "이번 주의 활동 리듬",
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
const lerp = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export default function WeeklyOrb({ intensities, locale, size = 184 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  // Latest intensities in a ref so the (size-scoped) loop reads fresh weekly data without
  // restarting the animation (which would re-seed the medium cells and visibly jump).
  const intensitiesRef = useRef(intensities);
  // The current draw fn, so the reduced-motion path can repaint a single static frame
  // when weekly data arrives after mount (no continuous animation).
  const drawRef = useRef<((ts: number) => void) | null>(null);

  useEffect(() => {
    intensitiesRef.current = intensities;
  }, [intensities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFailed(true); // canvas unavailable → static CSS-gradient presence fallback
      return;
    }

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
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
    const orbR = size * 0.29;

    // A brighter STATIC frame under reduced motion (no shimmer to draw the eye, so lift the
    // steady glow a touch to compensate).
    const glow = reduceMotion ? 1.15 : 1;

    // Inner-medium cells seeded once (decorative presence — Math.random is fine here; this
    // is NOT the deterministic /start door). Heavy soft overlap reads as a light field.
    const CELLS = 20;
    const cells = Array.from({ length: CELLS }, () => ({
      ang: Math.random() * Math.PI * 2,
      rad: Math.sqrt(Math.random()) * 0.7,
      angVel: (Math.random() < 0.5 ? -1 : 1) * (0.01 + Math.random() * 0.02),
      radFreq: 0.05 + Math.random() * 0.15,
      radPhase: Math.random() * Math.PI * 2,
      radAmp: 0.03 + Math.random() * 0.08,
      lobe: 0.14 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
      freq: 0.4 + Math.random() * 0.8,
    }));

    // Per-node statics — each of the 7 daily lights carries a slightly different resting
    // radius and its own slow wobble, so the orbiting ring feels organic, not mechanical.
    const nodeParams = Array.from({ length: 7 }, () => ({
      radOffset: (Math.random() - 0.5) * 0.08, // ± fraction of the ring radius
      wobPhase: Math.random() * Math.PI * 2,
      wobFreq: 0.05 + Math.random() * 0.06, // slow individual angular wobble
    }));

    let raf = 0;
    let last = 0;
    let t = 0;

    const draw = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt;

      const arr = intensitiesRef.current;
      const clamped = (arr.length > 0 ? arr : [0, 0, 0, 0, 0, 0, 0]).map((v) =>
        typeof v === "number" && v > 0 ? Math.min(5, v) : 0,
      );
      const n = clamped.length;
      const activeDays = clamped.filter((v) => v > 0).length;
      const mean = n > 0 ? clamped.reduce((s, v) => s + v, 0) / n : 0; // 0–5
      const vitality = mean / 5; // 0–1
      const density = n > 0 ? activeDays / n : 0; // 0–1
      const todayIdx = n - 1;

      // Low-amplitude breath; depth grows a touch with vitality. Reduced-motion → frozen.
      const beat = reduceMotion ? 0 : Math.sin(t * 0.9);
      const breath = 1 + (0.022 + 0.04 * vitality) * beat;
      // Very slow whole-ring rotation (~24s/rev) — weekly rhythm, not a spin.
      const commonRot = reduceMotion ? 0 : t * ((Math.PI * 2) / 24);
      // Gather on inhale (beat<0) → the daily lights ease inward and the weekly orb brightens
      // to RECEIVE them; release on exhale. `receive` = how far into the inhale we are (0–1).
      const receive = reduceMotion ? 0 : Math.max(0, -beat);

      ctx.clearRect(0, 0, size, size);

      // (1) Body — soft warm sphere; size & warmth ride vitality, bounded so a resting orb
      // is calm, never empty.
      const bodyR = orbR * (0.94 + 0.14 * vitality) * breath;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR);
      bg.addColorStop(0, rgba(morning, (0.46 + 0.2 * vitality) * glow));
      bg.addColorStop(0.55, rgba(morning, (0.3 + 0.12 * vitality) * glow));
      bg.addColorStop(0.85, rgba(morning, 0.14 * glow));
      bg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";

      // (2) Outer halo — a wide, soft bloom beyond the body so the orb is clearly present on
      // the dark Me surface without becoming neon.
      const haloR = orbR * (2.0 + 0.3 * vitality) * breath;
      const hg = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, haloR);
      hg.addColorStop(0, rgba(morning, (0.12 + 0.1 * vitality) * glow));
      hg.addColorStop(0.5, rgba(GOLD, (0.06 + 0.06 * vitality) * glow));
      hg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // (3) Core ember — warm amber; brightens with vitality AND with `receive` (the weekly
      // orb glows a little as the days' light gathers in). Alive, not a notification pulse.
      const coreR = orbR * 0.56 * breath;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, rgba(touch, (0.28 + 0.3 * vitality + 0.1 * receive) * glow));
      cg.addColorStop(0.45, rgba(touch, (0.15 + 0.16 * vitality) * glow));
      cg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // (4) Inner gold glow — the restrained warm-gold heart; also lifts with `receive`.
      const seedR = orbR * 0.32 * breath;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, seedR);
      sg.addColorStop(0, rgba(GOLD, (0.24 + 0.3 * vitality + 0.12 * receive) * glow));
      sg.addColorStop(0.5, rgba(GOLD, (0.11 + 0.14 * vitality) * glow));
      sg.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, seedR, 0, Math.PI * 2);
      ctx.fill();

      // (5) Inner medium — how many cells are "lit" scales with active-day density; the rest
      // linger faintly (never fully dead). More days lived → more inner life circulating.
      const visibleCells = Math.round(4 + density * (CELLS - 6));
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]!;
        const on = i < visibleCells ? 1 : 0.18;
        const ph = reduceMotion ? c.phase : t * c.freq + c.phase;
        const ang = reduceMotion ? c.ang : c.ang + c.angVel * t;
        const rOsc = c.rad + (reduceMotion ? 0 : Math.sin(t * c.radFreq + c.radPhase) * c.radAmp);
        const rr = Math.max(0, Math.min(0.8, rOsc)) * bodyR;
        const px = cx + Math.cos(ang) * rr;
        const py = cy + Math.sin(ang) * rr;
        const a = (0.035 + 0.07 * vitality) * on * (0.5 + 0.5 * Math.sin(ph)) * glow;
        if (a <= 0.002) continue;
        const R = c.lobe * orbR;
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, rgba(touch, a));
        g.addColorStop(0.5, rgba(touch, a * 0.35));
        g.addColorStop(1, rgba(morning, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, R, 0, Math.PI * 2);
        ctx.fill();
      }

      // (6) The week's daily lights — 7 orbiting on a slowly rotating ring. RADIUS,
      // brightness and warmth all rise with that day's intensity (low = small/cool/quiet,
      // high = larger/warm-gold/brighter). On inhale they gather inward and their glow
      // SOFTENS (absorbed into the weekly orb); on exhale they release outward. Today is a
      // gentle breathing BLINK (living, in progress) — no ring, no completed-marker outline.
      const ringBase = orbR * 1.36;
      // Today blink ~3.4s/cycle: opacity + glow radius breathe (no position change, no flash).
      const todayBlink = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.85);
      for (let i = 0; i < n; i++) {
        const inten = clamped[i]! / 5; // 0–1
        const np = nodeParams[i] ?? nodeParams[0]!;
        const isToday = i === todayIdx;
        const base = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ang =
          base + commonRot + (reduceMotion ? 0 : 0.06 * Math.sin(t * np.wobFreq + np.wobPhase));
        // Gather inward on inhale (receive), a touch more visible than before but still gentle.
        const ringR = ringBase * (1 + np.radOffset) * (1 - 0.09 * receive);
        const nx = cx + Math.cos(ang) * ringR;
        const ny = cy + Math.sin(ang) * ringR;

        // Radius by intensity (visibly but subtly). Today also breathes its radius via blink.
        const baseNodeR = size * (0.012 + 0.03 * inten);
        const nodeR = baseNodeR * (isToday ? 1 + 0.16 * todayBlink : 1);
        const glowR = nodeR * (2.9 + 0.8 * inten);

        // Warmth: cool/quiet (morning) at low intensity → warm restrained gold at high; when
        // gathered inward the tint blends toward the body tone (light softening into the orb).
        const warm = lerp(morning, GOLD, inten);
        const nodeCol = lerp(warm, morning, 0.4 * receive);

        // Brightness by intensity; today breathes; gathered lights soften (absorbed).
        let nodeA = (0.24 + 0.6 * inten) * glow * (1 - 0.34 * receive);
        if (isToday) nodeA *= 0.72 + 0.5 * todayBlink;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowR);
        ng.addColorStop(0, rgba(nodeCol, nodeA));
        ng.addColorStop(0.45, rgba(nodeCol, nodeA * 0.5));
        ng.addColorStop(1, rgba(nodeCol, 0));
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Living centre — a warm bright core so each day reads as a light, not dust. Scales
        // with intensity; today breathes; softens when absorbed.
        let dotA = Math.min(0.95, (0.4 + 0.55 * inten)) * glow * (1 - 0.3 * receive);
        if (isToday) dotA *= 0.72 + 0.5 * todayBlink;
        const dotCol = lerp(nodeCol, SHINE, 0.3 + 0.3 * inten);
        const dg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR);
        dg.addColorStop(0, rgba(dotCol, dotA));
        dg.addColorStop(1, rgba(nodeCol, 0));
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(nx, ny, nodeR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";

      // Reduced-motion: draw exactly ONE static frame — no autonomous motion. Otherwise keep
      // the calm living loop.
      if (!reduceMotion) raf = window.requestAnimationFrame(draw);
    };
    drawRef.current = draw;

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduceMotion) {
        last = 0; // fresh dt → no jump
        raf = window.requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = window.requestAnimationFrame(draw);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      drawRef.current = null;
    };
  }, [size]);

  // Reduced-motion only: the loop draws once at mount, so when weekly data resolves later
  // schedule a single repaint to reflect it (animated path already reads the ref per frame).
  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) return;
    const id = window.requestAnimationFrame((ts) => drawRef.current?.(ts));
    return () => window.cancelAnimationFrame(id);
  }, [intensities]);

  return (
    // Lifted slightly upward so the weekly light sits nearer the emotional centre of the Me
    // tab without crowding the mirror above.
    <div className="-mt-8 flex flex-col items-center gap-3 pb-8 pt-0">
      <div
        role="img"
        aria-label={ARIA[locale]}
        style={{ width: size, height: size, position: "relative" }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ display: failed ? "none" : "block", width: size, height: size }}
        />
        {failed ? (
          // Static presence fallback (canvas unavailable). Mirrors the --bty-orb-* token
          // fallbacks; static → also reduced-motion safe.
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 45%, rgba(227,162,90,0.55), rgba(189,131,72,0.34) 45%, rgba(189,131,72,0) 72%)",
            }}
          />
        ) : null}
      </div>
      <p className="text-xs tracking-[0.16em] text-white/40">{CAPTION[locale]}</p>
    </div>
  );
}
