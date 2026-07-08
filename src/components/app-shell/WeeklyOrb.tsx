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
 *   - today            → a living pulse-halo (temporal identity) — no ring, works even at 0
 *   - empty week       → a quiet RESTING orb (presence floor), never "failure"
 *
 * STEP 5 — true merge: the 7 daily lights orbit slowly and run a phased ~8s cycle —
 * GATHER far inward (~78%, past the core edge, trailing light) → a brief MERGE hold where
 * they read as one weekly light and the core FLARES with accumulated warmth → RELEASE back
 * out into 7 distinct intensity-sized days. Today breathes a soft warm pulse so you can tell
 * which light is today. The canvas is larger than the orb so all glows fade to zero BEFORE
 * the square edge — no rectangular frame; the light blends into the dark Me surface. Reduced
 * motion → a brighter STATIC orb + static intensity-sized nodes + a static today halo (no
 * orbit / merge / pulse loop; single repaint when data arrives).
 */

type Locale = "en" | "ko";

type Props = {
  intensities: number[];
  locale: Locale;
  /** Canvas diameter in px (glows fade well inside this). Default 280. */
  size?: number;
};

type RGB = { r: number; g: number; b: number };

// Fallbacks MIRROR globals.css --bty-orb-* token values (used only if getComputedStyle
// returns empty). NOT new colours. #C9A66B is the restrained warm-gold accent.
const TOKEN_FALLBACK = { morning: "#BD8348", touch: "#E3A25A" };
const GOLD: RGB = { r: 201, g: 166, b: 107 }; // #C9A66B
const SHINE: RGB = { r: 255, g: 246, b: 228 }; // warm near-white for living node centres

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
// Smooth 0→1 ease used to shape the gather / release so the merge feels organic (no
// suction, no spinner).
function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export default function WeeklyOrb({ intensities, locale, size = 280 }: Props) {
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
    // orbR kept small vs the canvas so the halo, node glows and today pulse-halo all fade to
    // zero well before the square edge → no rectangular frame is ever revealed.
    const orbR = size * 0.14;

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
      radOffset: (Math.random() - 0.5) * 0.07,
      wobPhase: Math.random() * Math.PI * 2,
      wobFreq: 0.05 + Math.random() * 0.06,
    }));

    const CYCLE = 8; // seconds — full gather → merge hold → release → rest

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
      // Today = the freshest (last) bucket. The server builds the 7-day series ENDING at
      // today, so the last index is today by construction — temporal, not score-based, and
      // needing no date math here (so no UTC mismatch to fix in this component).
      const todayIdx = n - 1;

      const beat = reduceMotion ? 0 : Math.sin(t * 0.9);
      const breath = 1 + (0.02 + 0.035 * vitality) * beat;
      const commonRot = reduceMotion ? 0 : t * ((Math.PI * 2) / 24);
      // Merge amount m: 0 released (7 distinct) → 1 merged (one light). Gather (slower),
      // brief hold, smooth release, then a rest with the days fully separated.
      let m = 0;
      if (!reduceMotion) {
        const cyc = (t % CYCLE) / CYCLE;
        if (cyc < 0.47) m = smoothstep(0.06, 0.47, cyc); // gather
        else if (cyc < 0.55) m = 1; // merge hold (~0.64s "one light")
        else if (cyc < 0.9) m = 1 - smoothstep(0.55, 0.9, cyc); // release
        else m = 0; // rest — 7 distinct living days
      }
      // Today pulse ~3.2s — a living breath of alpha + a soft warm halo (no ring, no flash).
      const todayPulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * ((Math.PI * 2) / 3.2));

      ctx.clearRect(0, 0, size, size);

      // (1) Body — luminous warm sphere; size & warmth ride vitality, bounded so a resting
      // orb is calm, never empty.
      const bodyR = orbR * (0.96 + 0.14 * vitality) * breath;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR);
      bg.addColorStop(0, rgba(morning, (0.58 + 0.16 * vitality) * glow));
      bg.addColorStop(0.55, rgba(morning, (0.36 + 0.12 * vitality) * glow));
      bg.addColorStop(0.85, rgba(morning, 0.16 * glow));
      bg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";

      // (2) Outer halo — a wide, soft circular bloom that EXPANDS slightly at merge peak and
      // still fades fully inside the canvas (no rectangular clip).
      const haloR = orbR * (2.6 + 0.5 * m) * breath;
      const hg = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, haloR);
      hg.addColorStop(0, rgba(morning, (0.16 + 0.1 * vitality) * glow));
      hg.addColorStop(0.5, rgba(GOLD, (0.09 + 0.06 * vitality) * glow));
      hg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // (3) Core ember — warm amber; brightens with vitality AND strongly with merge `m` (the
      // weekly orb receiving the gathered days). Alive, not a notification pulse.
      const coreR = orbR * 0.58 * breath;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, rgba(touch, (0.38 + 0.26 * vitality + 0.3 * m) * glow));
      cg.addColorStop(0.45, rgba(touch, (0.2 + 0.16 * vitality) * glow));
      cg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // (4) Inner gold heart — restrained warm-gold; lifts with vitality + merge.
      const seedR = orbR * 0.34 * breath;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, seedR);
      sg.addColorStop(0, rgba(GOLD, (0.32 + 0.26 * vitality + 0.3 * m) * glow));
      sg.addColorStop(0.5, rgba(GOLD, (0.14 + 0.14 * vitality) * glow));
      sg.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, seedR, 0, Math.PI * 2);
      ctx.fill();

      // (4b) Merge flare — a soft warm bloom that appears only near the merge peak: the
      // accumulated light of the week's days becoming one. Smooth, organic, brief.
      if (m > 0.01) {
        const flareR = orbR * (1.5 + 0.7 * m) * breath;
        const fa = 0.24 * m * glow;
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareR);
        fg.addColorStop(0, rgba(GOLD, fa));
        fg.addColorStop(0.5, rgba(touch, fa * 0.45));
        fg.addColorStop(1, rgba(morning, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(cx, cy, flareR, 0, Math.PI * 2);
        ctx.fill();
      }

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
        const a = (0.05 + 0.08 * vitality) * on * (0.5 + 0.5 * Math.sin(ph)) * glow;
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

      // (6) The week's daily lights — 7 orbiting on a slowly rotating ring. On the merge
      // cycle they gather ~78% inward (past the core edge → one light), softening and
      // trailing toward the centre, then release back to 7 distinct intensity-sized days.
      // Today carries a warm breathing pulse-halo so its light is identifiable.
      const ringBase = orbR * 1.5;
      for (let i = 0; i < n; i++) {
        const inten = clamped[i]! / 5; // 0–1
        const np = nodeParams[i] ?? nodeParams[0]!;
        const isToday = i === todayIdx;
        const base = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ang =
          base + commonRot + (reduceMotion ? 0 : 0.05 * Math.sin(t * np.wobFreq + np.wobPhase));
        // True near-merge: contract up to 78% of orbit radius (node falls inside the core).
        const ringR = ringBase * (1 + np.radOffset) * (1 - 0.78 * m);
        const nx = cx + Math.cos(ang) * ringR;
        const ny = cy + Math.sin(ang) * ringR;

        // Radius/warmth by intensity (visibly different). Today breathes its radius a touch.
        const baseNodeR = orbR * (0.16 + 0.3 * inten);
        const nodeR = baseNodeR * (isToday ? 1 + 0.1 * todayPulse : 1);
        const glowR = nodeR * (2.2 + 0.5 * inten);
        const warm = lerp(morning, GOLD, inten);
        const nodeCol = lerp(warm, morning, 0.4 * m); // blends into the body as it merges

        // Faint trails toward the centre while gathering — light being drawn in (subtle).
        if (!reduceMotion && m > 0.08) {
          for (const k of [0.66, 0.4]) {
            const tx = nx + (cx - nx) * k;
            const ty = ny + (cy - ny) * k;
            const tr = baseNodeR * (0.95 - 0.35 * k);
            const ta = 0.14 * (0.4 + 0.6 * inten) * m * (1 - k * 0.55);
            const tgr = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
            tgr.addColorStop(0, rgba(nodeCol, ta));
            tgr.addColorStop(1, rgba(nodeCol, 0));
            ctx.fillStyle = tgr;
            ctx.beginPath();
            ctx.arc(tx, ty, tr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Today's living pulse-halo — a soft warm aura that breathes (~3.2s). Present even at
        // intensity 0 (temporal identity), and eased down at merge peak so it doesn't shout.
        if (isToday) {
          const phaloR = baseNodeR * (2.8 + 0.9 * todayPulse);
          const phaloA = (0.14 + 0.12 * todayPulse) * glow * (1 - 0.5 * m);
          const pg = ctx.createRadialGradient(nx, ny, 0, nx, ny, phaloR);
          pg.addColorStop(0, rgba(GOLD, phaloA));
          pg.addColorStop(0.5, rgba(GOLD, phaloA * 0.4));
          pg.addColorStop(1, rgba(GOLD, 0));
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(nx, ny, phaloR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node glow — bright, glowing (not dust). Softens/fades as it merges (light mass is
        // carried by the central flare). Today also breathes its alpha.
        let nodeA = (0.42 + 0.55 * inten) * glow * (1 - 0.55 * m);
        if (isToday) nodeA *= 0.65 + 0.6 * todayPulse;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowR);
        ng.addColorStop(0, rgba(nodeCol, Math.min(0.95, nodeA)));
        ng.addColorStop(0.4, rgba(nodeCol, nodeA * 0.5));
        ng.addColorStop(1, rgba(nodeCol, 0));
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Living centre — a warm bright core so each day reads as a light. Fades hard at the
        // merge peak (individual dots dissolve into the one light), returns on release.
        let dotA = Math.min(0.98, 0.55 + 0.4 * inten) * glow * (1 - 0.7 * m);
        if (isToday) dotA *= 0.65 + 0.6 * todayPulse;
        const dotCol = lerp(nodeCol, SHINE, 0.35 + 0.35 * inten);
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
    // No card / no background fill / no wrapper gradient — only light. Lifted well upward so
    // the weekly light occupies the open space between the mirror and the companion dock;
    // the caption is pulled snug under the orb and given safe bottom padding so the dock
    // never clips it.
    <div className="-mt-20 flex flex-col items-center pb-12">
      <div
        role="img"
        aria-label={ARIA[locale]}
        style={{ width: size, height: size, position: "relative", marginBottom: -18 }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ display: failed ? "none" : "block", width: size, height: size }}
        />
        {failed ? (
          // Static presence fallback (canvas unavailable). Circular, mirrors the --bty-orb-*
          // token fallbacks; fades before the edge; reduced-motion safe.
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 50%, rgba(227,162,90,0.6), rgba(189,131,72,0.34) 40%, rgba(189,131,72,0) 66%)",
            }}
          />
        ) : null}
      </div>
      <p className="text-xs tracking-[0.16em] text-white/45">{CAPTION[locale]}</p>
    </div>
  );
}
