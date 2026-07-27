"use client";

import { useEffect, useRef, useState } from "react";
import type { MeWeeklyRhythm } from "@/components/app-shell/meWeeklyRhythm";
import { weeklyOrbLights, WEEKLY_LIGHT_COUNT } from "@/domain/daily/weeklyOrbGeometry";

/**
 * WeeklyOrb — the Me weekly-trace presence (Slice 3.2C-B3A.2D-R3 rework).
 *
 * EXACTLY SEVEN individually-distinguishable lights, one per BTY day (index 0 = oldest …
 * index 6 = today). Positions come from the pure, BOUNDED {@link weeklyOrbLights} geometry, so the
 * lights orbit on a ring that never approaches the centre and never merges — the previous
 * gather→merge→flare cycle and the bright central core/heart/flare (which read as an eighth light
 * and recreated the startup entry Orb) are GONE. Only a faint DIFFUSE ambient glow remains behind
 * the lights (never a distinct centroid). Today's emphasis is applied to today's own light (a
 * modest brightness lift + slightly larger halo + subtle pulse), never a new central dot.
 *
 * This is a Me-only visual; it does NOT reuse OrbLiving / Orb.tsx and never calls a haptic. The
 * canvas + rAF loop are keyed on `size` only (stable identity), reads live intensities via a ref,
 * pauses while the tab is hidden, and renders a single static frame under reduced motion.
 */

type Locale = "en" | "ko";
type RGB = { r: number; g: number; b: number };

const TOKEN_FALLBACK = { morning: "#BD8348", touch: "#E3A25A" };
const GOLD: RGB = { r: 201, g: 166, b: 107 }; // #C9A66B
const SHINE: RGB = { r: 255, g: 247, b: 231 };

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

type Props = {
  intensities: MeWeeklyRhythm;
  locale: Locale;
  /** Canvas diameter in px (glows fade inside this). Default 220. */
  size?: number;
};

export default function WeeklyOrb({ intensities, locale, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const intensitiesRef = useRef(intensities);
  const drawRef = useRef<((ts: number) => void) | null>(null);

  useEffect(() => {
    intensitiesRef.current = intensities;
  }, [intensities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setFailed(true);
      return;
    }

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const reduceMotion =
      typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const morning = readToken("--bty-orb-morning", TOKEN_FALLBACK.morning);
    const touch = readToken("--bty-orb-touch", TOKEN_FALLBACK.touch);

    const cx = size / 2;
    const cy = size / 2;
    const glow = reduceMotion ? 1.12 : 1;

    // Per-day intensity in [0,1] (source is 0–5). Padded/truncated to exactly 7 so light i ↔ day i.
    const dayIntensity = (i: number): number => {
      const arr = intensitiesRef.current;
      const v = Array.isArray(arr) && typeof arr[i] === "number" ? (arr[i] as number) : 0;
      return v > 0 ? Math.min(5, v) / 5 : 0;
    };

    let raf = 0;
    let last = 0;
    let t = 0;

    const draw = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += reduceMotion ? 0 : dt;

      ctx.clearRect(0, 0, size, size);

      // Diffuse ambient body — a soft, low-alpha warmth behind the lights. NOT a distinct centroid
      // (no bright core / heart / flare): it only keeps the Orb from reading as seven lights on
      // black. Fades to zero well inside the canvas edge.
      const bodyR = size * 0.42;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR);
      bg.addColorStop(0, rgba(morning, 0.1 * glow));
      bg.addColorStop(0.6, rgba(morning, 0.05 * glow));
      bg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fill();

      // Seven lights — bounded ring geometry; each stays distinct and never collapses inward.
      ctx.globalCompositeOperation = "lighter";
      const lights = weeklyOrbLights(t, size);
      const todayPulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * ((Math.PI * 2) / 3.4));
      for (const light of lights) {
        const inten = dayIntensity(light.i);
        // Baseline visibility so no-activity days remain individually visible (quieter, not absent);
        // recorded-activity days are clearer/brighter.
        const warmth = lerp(morning, GOLD, inten);
        const emphasis = light.isToday ? 1 : 0; // today's own light — no separate centroid
        const baseA = 0.34 + 0.5 * inten + 0.12 * emphasis * todayPulse;
        const coreCol = lerp(warmth, SHINE, 0.3 + 0.35 * inten);

        // Outer soft halo (larger for today only, centred on THIS light).
        const haloR = size * (0.075 + 0.045 * inten) * (1 + 0.35 * emphasis);
        const hg = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, haloR);
        hg.addColorStop(0, rgba(warmth, Math.min(0.9, baseA) * glow));
        hg.addColorStop(0.45, rgba(warmth, baseA * 0.4 * glow));
        hg.addColorStop(1, rgba(warmth, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(light.x, light.y, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Bright inner centre — small, keeps each light readable as a distinct point.
        const coreR = size * (0.02 + 0.016 * inten);
        const cg = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, coreR);
        cg.addColorStop(0, rgba(coreCol, Math.min(0.98, baseA + 0.2) * glow));
        cg.addColorStop(1, rgba(warmth, 0));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(light.x, light.y, coreR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      if (!reduceMotion) raf = window.requestAnimationFrame(draw);
    };
    drawRef.current = draw;

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduceMotion) {
        last = 0;
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

  // Reduced-motion: repaint the single static frame when data resolves after mount.
  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) return;
    const id = window.requestAnimationFrame((ts) => drawRef.current?.(ts));
    return () => window.cancelAnimationFrame(id);
  }, [intensities]);

  return (
    <div className="flex flex-col items-center pb-4 select-none" data-testid="weekly-orb" data-light-count={WEEKLY_LIGHT_COUNT}>
      <div role="img" aria-label={ARIA[locale]} style={{ width: size, height: size, position: "relative" }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          draggable={false}
          style={{ display: failed ? "none" : "block", width: size, height: size, WebkitUserDrag: "none" } as React.CSSProperties}
        />
        {failed ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 50%, rgba(227,162,90,0.4), rgba(189,131,72,0.24) 40%, rgba(189,131,72,0) 66%)",
            }}
          />
        ) : null}
      </div>
      <p className="text-xs tracking-[0.16em] text-white/45">{CAPTION[locale]}</p>
    </div>
  );
}
