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
 *   - today            → a breathing warm halo + outward crescent + short trail (temporal;
 *                        NOT brighter — brightness stays reserved for activity intensity)
 *   - empty week       → a quiet RESTING orb (presence floor), never "failure"
 *
 * STEP 6 — hybrid rhythm "7 distinct days → one weekly light → 7 distinct days":
 * released, the 7 daily lights are distinct and intensity-sized; on the ~8s cycle they
 * gather ~90% inward and — near the peak (a brief ~0.6s hold) — their individual centres
 * DISSOLVE while the core FLARES, so the viewer reads ONE weekly light, not seven clustered
 * dots; then they release and regain identity. Today is always identifiable (a breathing
 * breathing warm halo + outward crescent + short trail — never a ring/label). The canvas is
 * larger than the orb so every glow fades to zero before the square edge (no rectangular
 * frame). Reduced motion → a brighter STATIC orb + static intensity-sized nodes + a static
 * today halo (no orbit / merge / pulse loop; single repaint when data arrives).
 */

type Locale = "en" | "ko";

type Props = {
  intensities: number[];
  locale: Locale;
  /** Canvas diameter in px (glows fade well inside this). Default 240. */
  size?: number;
};

type RGB = { r: number; g: number; b: number };

const TOKEN_FALLBACK = { morning: "#BD8348", touch: "#E3A25A" };
const GOLD: RGB = { r: 201, g: 166, b: 107 }; // #C9A66B
const SHINE: RGB = { r: 255, g: 247, b: 231 }; // warm near-white for living node centres

const CAPTION: Record<Locale, string> = {
  en: "This week's trace",
  ko: "이번 주의 흔적",
};
const ARIA: Record<Locale, string> = {
  en: "Your rhythm this week",
  ko: "이번 주의 활동 리듬",
};

// One-time quiet whisper teaching the today marker (not a label/CTA/tooltip).
const HINT: Record<Locale, string> = {
  en: "The breathing light is today.",
  ko: "숨 쉬는 빛이 오늘입니다.",
};
// Count-based gate: show the whisper for the first few views only, then never again.
const HINT_KEY = "bty.weeklyOrb.todayHint.count.v1";
const HINT_MAX_VIEWS = 3;
// Fallback when localStorage is unavailable → count within the current session only.
let sessionHintCount = 0;

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
// Smooth 0→1 ease — shapes gather / release / absorption so nothing snaps.
function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export default function WeeklyOrb({ intensities, locale, size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [hintIn, setHintIn] = useState(false);
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
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const morning = readToken("--bty-orb-morning", TOKEN_FALLBACK.morning);
    const touch = readToken("--bty-orb-touch", TOKEN_FALLBACK.touch);

    const cx = size / 2;
    const cy = size / 2;
    // orbR kept small vs the canvas so halo, node glows and today halo all fade to zero well
    // before the square edge → no rectangular frame.
    const orbR = size * 0.14;
    const glow = reduceMotion ? 1.15 : 1;

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

    const nodeParams = Array.from({ length: 7 }, () => ({
      radOffset: (Math.random() - 0.5) * 0.07,
      wobPhase: Math.random() * Math.PI * 2,
      wobFreq: 0.05 + Math.random() * 0.06,
    }));

    const CYCLE = 8; // seconds — gather → brief merge hold → release → rest

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
      const mean = n > 0 ? clamped.reduce((s, v) => s + v, 0) / n : 0;
      const vitality = mean / 5;
      const density = n > 0 ? activeDays / n : 0;
      // Today = the freshest (last) bucket. The server builds the 7-day series ENDING at
      // today, so the last index is today by construction — temporal, positional, and needs
      // no date comparison here (so there is no UTC/local mismatch to fix in this component).
      const todayIdx = n - 1;

      const beat = reduceMotion ? 0 : Math.sin(t * 0.9);
      const breath = 1 + (0.02 + 0.035 * vitality) * beat;
      const commonRot = reduceMotion ? 0 : t * ((Math.PI * 2) / 24);
      // Merge amount m: 0 released (7 distinct) → 1 merged (one light).
      let m = 0;
      if (!reduceMotion) {
        const cyc = (t % CYCLE) / CYCLE;
        if (cyc < 0.47) m = smoothstep(0.06, 0.47, cyc); // gather
        else if (cyc < 0.55) m = 1; // merge hold (~0.64s "one light")
        else if (cyc < 0.9) m = 1 - smoothstep(0.55, 0.9, cyc); // release
        else m = 0; // rest — 7 distinct living days
      }
      // absorbHi ramps in only near the peak → that is when individual nodes truly dissolve
      // and the core flare takes over as the single weekly light.
      const absorbHi = reduceMotion ? 0 : smoothstep(0.72, 1, m);
      const todayPulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * ((Math.PI * 2) / 3.1));

      ctx.clearRect(0, 0, size, size);

      // (1) Body.
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

      // (2) Outer halo — expands slightly at merge peak; fades inside the canvas.
      const haloR = orbR * (2.6 + 0.6 * m) * breath;
      const hg = ctx.createRadialGradient(cx, cy, orbR * 0.5, cx, cy, haloR);
      hg.addColorStop(0, rgba(morning, (0.16 + 0.1 * vitality) * glow));
      hg.addColorStop(0.5, rgba(GOLD, (0.09 + 0.06 * vitality) * glow));
      hg.addColorStop(1, rgba(morning, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // (3) Core ember — brightens strongly with merge (receiving the gathered days).
      const coreR = orbR * 0.58 * breath;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, rgba(touch, (0.38 + 0.26 * vitality + 0.3 * m + 0.18 * absorbHi) * glow));
      cg.addColorStop(0.45, rgba(touch, (0.2 + 0.16 * vitality + 0.1 * absorbHi) * glow));
      cg.addColorStop(1, rgba(touch, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // (4) Inner gold heart.
      const seedR = orbR * 0.34 * breath;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, seedR);
      sg.addColorStop(0, rgba(GOLD, (0.32 + 0.26 * vitality + 0.3 * m + 0.2 * absorbHi) * glow));
      sg.addColorStop(0.5, rgba(GOLD, (0.14 + 0.14 * vitality) * glow));
      sg.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, seedR, 0, Math.PI * 2);
      ctx.fill();

      // (4b) Merge flare — the single unified weekly light at peak. Dominant only briefly.
      if (m > 0.01) {
        const flareR = orbR * (1.5 + 0.9 * m) * breath;
        const fa = (0.16 * m + 0.36 * absorbHi) * glow;
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareR);
        fg.addColorStop(0, rgba(SHINE, fa * 0.55));
        fg.addColorStop(0.35, rgba(GOLD, fa));
        fg.addColorStop(1, rgba(morning, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(cx, cy, flareR, 0, Math.PI * 2);
        ctx.fill();
      }

      // (5) Inner medium.
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

      // (6) The week's daily lights.
      const ringBase = orbR * 1.5;
      for (let i = 0; i < n; i++) {
        const inten = clamped[i]! / 5;
        const np = nodeParams[i] ?? nodeParams[0]!;
        const isToday = i === todayIdx;
        const base = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ang =
          base + commonRot + (reduceMotion ? 0 : 0.05 * Math.sin(t * np.wobFreq + np.wobPhase));
        // Gather ~90% inward → at peak the node centres coincide near the core.
        const ringR = ringBase * (1 + np.radOffset) * (1 - 0.9 * m);
        const nx = cx + Math.cos(ang) * ringR;
        const ny = cy + Math.sin(ang) * ringR;

        const baseNodeR = orbR * (0.16 + 0.3 * inten);
        // Node size = activity intensity ONLY (today's identity is its halo, not its size).
        const nodeR = baseNodeR;
        const glowR = nodeR * (2.2 + 0.5 * inten);
        const warm = lerp(morning, GOLD, inten);
        const nodeCol = lerp(warm, morning, 0.4 * m);

        // Trails toward the centre while gathering.
        if (!reduceMotion && m > 0.08) {
          for (const k of [0.66, 0.4]) {
            const tx = nx + (cx - nx) * k;
            const ty = ny + (cy - ny) * k;
            const tr = baseNodeR * (0.95 - 0.35 * k);
            const ta = 0.14 * (0.4 + 0.6 * inten) * m * (1 - k * 0.55) * (1 - absorbHi);
            const tgr = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
            tgr.addColorStop(0, rgba(nodeCol, ta));
            tgr.addColorStop(1, rgba(nodeCol, 0));
            ctx.fillStyle = tgr;
            ctx.beginPath();
            ctx.arc(tx, ty, tr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Today identity — a warm breathing halo (size partly independent of intensity, so
        // today reads even at 0), plus a short trailing glow. Brightness is NOT used (that is
        // reserved for intensity). Eased down at
        // the merge peak so it, too, dissolves into the one light, then returns on release.
        if (isToday) {
          // short trailing glow behind the orbiting today node (the living day in motion)
          if (!reduceMotion && absorbHi < 0.9) {
            for (let s = 1; s <= 2; s++) {
              const tAng = ang - s * 0.14;
              const txx = cx + Math.cos(tAng) * ringR;
              const tyy = cy + Math.sin(tAng) * ringR;
              const trr = baseNodeR * (1.1 - 0.25 * s);
              const taa = (0.16 - 0.05 * s) * glow * (1 - absorbHi);
              const trg = ctx.createRadialGradient(txx, tyy, 0, txx, tyy, trr);
              trg.addColorStop(0, rgba(GOLD, taa));
              trg.addColorStop(1, rgba(GOLD, 0));
              ctx.fillStyle = trg;
              ctx.beginPath();
              ctx.arc(txx, tyy, trr, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          const phaloR = orbR * (0.55 + 0.5 * todayPulse) + baseNodeR;
          const phaloA = (0.26 + 0.18 * todayPulse) * glow * (1 - absorbHi);
          // Warm breathing aura offset slightly OUTWARD → a soft crescent lean (a distinct
          // SHAPE no other node has); today reads by presence/motion, not luminance.
          const ox = Math.cos(ang) * baseNodeR * 0.7;
          const oy = Math.sin(ang) * baseNodeR * 0.7;
          const pg = ctx.createRadialGradient(nx + ox, ny + oy, 0, nx, ny, phaloR);
          pg.addColorStop(0, rgba(GOLD, phaloA));
          pg.addColorStop(0.5, rgba(GOLD, phaloA * 0.4));
          pg.addColorStop(1, rgba(GOLD, 0));
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(nx, ny, phaloR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node glow — dissolves near the merge peak (absorbHi) so individual dots vanish and
        // the core flare is the single light; restores on release.
        // Brightness = activity intensity ONLY — today gets no luminance advantage, so the
        // "brightest" light never reads as "today"; today's cue is the breathing halo/trail.
        const nodeA = (0.42 + 0.55 * inten) * glow * (1 - 0.55 * m) * (1 - 0.85 * absorbHi);
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowR);
        ng.addColorStop(0, rgba(nodeCol, Math.min(0.95, nodeA)));
        ng.addColorStop(0.4, rgba(nodeCol, nodeA * 0.5));
        ng.addColorStop(1, rgba(nodeCol, 0));
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Living centre — bright warm core; size/brightness track intensity for ALL days
        // (today included). Fully dissolves at peak.
        const dotA = Math.min(0.98, 0.55 + 0.4 * inten) * glow * (1 - 0.7 * m) * (1 - 0.9 * absorbHi);
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

  // Reduced-motion only: repaint once when data resolves after mount.
  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) return;
    const id = window.requestAnimationFrame((ts) => drawRef.current?.(ts));
    return () => window.cancelAnimationFrame(id);
  }, [intensities]);

  // Quiet whisper teaching the today marker. Shown for the first HINT_MAX_VIEWS views only
  // (counted in localStorage), fading in after the orb is visible and fading out on its own.
  // Fail-soft: if storage is unavailable, count within the current session only, never crash.
  useEffect(() => {
    let count = 0;
    let storageOk = true;
    try {
      const raw = window.localStorage.getItem(HINT_KEY);
      count = raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      storageOk = false;
    }
    if (!storageOk) count = sessionHintCount;
    if (count >= HINT_MAX_VIEWS) return;
    // Mount hidden, then fade in on the next frame (soft fade-in after the orb is visible).
    setHintShown(true);
    const raf = window.requestAnimationFrame(() => setHintIn(true));
    // Count this view (only now that it is actually being shown).
    const next = count + 1;
    if (storageOk) {
      try {
        window.localStorage.setItem(HINT_KEY, String(next));
      } catch {
        /* fail-soft: no persist */
      }
    } else {
      sessionHintCount = next;
    }
    const tOut = window.setTimeout(() => setHintIn(false), 5000); // hold ~5s, then fade out
    const tHide = window.setTimeout(() => setHintShown(false), 5800); // unmount after fade
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tOut);
      window.clearTimeout(tHide);
    };
  }, []);

  return (
    // No card / no background fill / no wrapper gradient — only light. The shell applies the
    // upward lift; here the caption is pulled snug under the orb with safe bottom spacing.
    <div className="flex flex-col items-center pb-6">
      <div
        role="img"
        aria-label={ARIA[locale]}
        style={{ width: size, height: size, position: "relative", marginBottom: -14 }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ display: failed ? "none" : "block", width: size, height: size }}
        />
        {failed ? (
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
      {hintShown ? (
        // A quiet product whisper — small, soft, no box/icon/colour; fades in then out.
        <p
          className="mt-1.5 text-[11px] leading-relaxed text-white/35 transition-opacity duration-700 ease-out"
          style={{ opacity: hintIn ? 1 : 0 }}
        >
          {HINT[locale]}
        </p>
      ) : null}
    </div>
  );
}
