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
 *   - each day's value → one faint orbital light node (the week's shape as light)
 *   - today            → a subtle temporal halo on its node only
 *   - empty week       → a quiet RESTING orb (presence floor), never "failure"
 */

type Locale = "en" | "ko";

type Props = {
  /** Per-day visual intensity 0–5 (weekly-stats projection). Empty → resting orb. */
  intensities: number[];
  locale: Locale;
  /** Pixel diameter. Default 168. */
  size?: number;
};

type RGB = { r: number; g: number; b: number };

// Fallbacks MIRROR globals.css --bty-orb-* token values (used only if getComputedStyle
// returns empty). NOT new colours. #C9A66B is the restrained warm-gold accent.
const TOKEN_FALLBACK = { morning: "#BD8348", touch: "#E3A25A" };
const GOLD: RGB = { r: 201, g: 166, b: 107 }; // #C9A66B

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

export default function WeeklyOrb({ intensities, locale, size = 168 }: Props) {
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
    const orbR = size * 0.32;

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
      const breath = 1 + (0.015 + 0.03 * vitality) * beat;

      ctx.clearRect(0, 0, size, size);

      // (1) Body — soft warm sphere; size & warmth ride vitality, bounded so a resting
      // orb is calm, never empty.
      const bodyR = orbR * (0.9 + 0.14 * vitality) * breath;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR);
      bg.addColorStop(0, rgba(morning, 0.3 + 0.16 * vitality));
      bg.addColorStop(0.6, rgba(morning, 0.2 + 0.1 * vitality));
      bg.addColorStop(0.9, rgba(morning, 0.1));
      bg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";

      // (2) Core ember — brightness ties to vitality (calm week = dim, not absent).
      const coreR = orbR * 0.5 * breath;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, rgba(touch, 0.12 + 0.22 * vitality));
      cg.addColorStop(0.5, rgba(touch, 0.06 + 0.1 * vitality));
      cg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // (3) Inner medium — how many cells are "lit" scales with active-day density; the
      // rest linger faintly (never fully dead). More days lived → more inner life.
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
        const a = (0.02 + 0.05 * vitality) * on * (0.5 + 0.5 * Math.sin(ph));
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

      // (4) Weekly rhythm — 7 faint orbital nodes on a ring just outside the body; each
      // day's brightness = its intensity (resting dot even at 0). Today gets ONLY a subtle
      // halo. The week's shape as light — not bars, not a per-day readout.
      const ringR = orbR * 1.28;
      for (let i = 0; i < n; i++) {
        const inten = clamped[i]! / 5; // 0–1
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2; // top, clockwise
        const nx = cx + Math.cos(ang) * ringR;
        const ny = cy + Math.sin(ang) * ringR;
        const nodeA = 0.1 + 0.55 * inten;
        const nodeR = size * (0.012 + 0.02 * inten);
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 3);
        ng.addColorStop(0, rgba(GOLD, nodeA));
        ng.addColorStop(0.5, rgba(GOLD, nodeA * 0.4));
        ng.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, nodeR * 3, 0, Math.PI * 2);
        ctx.fill();

        if (i === todayIdx) {
          const haloA = 0.12 + 0.05 * (reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.8));
          ctx.strokeStyle = rgba(GOLD, haloA);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(nx, ny, nodeR * 3.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = "source-over";

      // Reduced-motion: draw exactly ONE static frame — no autonomous motion. Otherwise
      // keep the calm living loop.
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
    <div className="flex flex-col items-center gap-3 pb-8 pt-2">
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
                "radial-gradient(circle at 50% 45%, rgba(227,162,90,0.4), rgba(189,131,72,0.22) 45%, rgba(189,131,72,0) 72%)",
            }}
          />
        ) : null}
      </div>
      <p className="text-xs tracking-[0.16em] text-white/40">{CAPTION[locale]}</p>
    </div>
  );
}
