/**
 * orbBodyShading — LAB-ONLY volumetric body/surface shading for OrbLiving (STEP 2).
 *
 * "Body onto Golden Master": this pass shapes the SPHERE'S BODY (limb darkening, bottom
 * density, a subtle depth/specular, an optional grounding shadow) so the Orb reads as a
 * volumetric object. It is the canvas answer to the failed CSS Orb Lab — shade the body
 * in the SAME renderer that owns the additive luminosity, never rebuild light on a new
 * body. It does NOT add interior light, particles, touch bloom, animation, or state.
 *
 * Composition contract (caller-owned — MUST be honoured):
 *  - Call ONLY in OrbLiving's source-over region: AFTER the body/skin fill (pass 1) and
 *    BEFORE globalCompositeOperation switches to "lighter". The additive interior passes
 *    (2–6) are never touched.
 *  - Pure + self-contained: no React, no DOM/CSS, no haptics, no global/module state, no
 *    time input, no Math.random → introduces NO new motion. It fully save()/restore()s the
 *    context (clip, fillStyle, globalCompositeOperation) so the caller's source-over state
 *    is restored on return.
 *
 * All effects derive only from the passed body geometry (already breathing via the caller's
 * shellPulse), so under reduced motion — where OrbLiving draws a single frame — this simply
 * renders once, statically.
 */

export interface OrbBodyShadingParams {
  /** Body centre x, in the caller's (dpr-scaled) canvas space. */
  cx: number;
  /** Body centre y. */
  cy: number;
  /** Body radius (the caller's shellR). */
  radius: number;
  /** Limb-darkening strength 0..1 (rim shading → curved surface). Default 0.34. */
  limb?: number;
  /** Bottom-density strength 0..1 (downward mass/weight). Default 0.26. */
  bottom?: number;
  /** Grounding-shadow strength 0..1 (0 disables). Drawn BEHIND the body. Default 0.18. */
  grounding?: number;
  /** Specular-highlight strength 0..1 (0 disables). Faint single-light cue. Default 0.05. */
  specular?: number;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Draw the lab-only body-shading pass. See the file header for the composition contract.
 * No-ops on a non-positive radius. Never throws on a minimal 2D context.
 */
export function drawOrbBodyShading(
  ctx: CanvasRenderingContext2D,
  params: OrbBodyShadingParams,
): void {
  const { cx, cy, radius } = params;
  if (!(radius > 0)) return; // nothing to shade

  const limb = clamp01(params.limb ?? 0.34);
  const bottom = clamp01(params.bottom ?? 0.26);
  const grounding = clamp01(params.grounding ?? 0.18);
  const specular = clamp01(params.specular ?? 0.05);

  ctx.save();

  // (a) Grounding shadow — a soft dark pool BEHIND the body. `destination-over` places it
  // behind the already-drawn pixels, offset just below the orb, so the sphere reads as
  // resting on a surface. Neutral, low-alpha; never over the interior light. GCO is set
  // straight back to source-over so nothing downstream inherits it.
  if (grounding > 0) {
    ctx.globalCompositeOperation = "destination-over";
    const gy = cy + radius * 0.78;
    const gr = radius * 0.95;
    const gg = ctx.createRadialGradient(cx, gy, 0, cx, gy, gr);
    gg.addColorStop(0, `rgba(0,0,0,${0.5 * grounding})`);
    gg.addColorStop(0.6, `rgba(0,0,0,${0.2 * grounding})`);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(cx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Confine all remaining darkening/highlight to the body disk so nothing spills onto the
  // surrounding field (source-over shading clipped to the sphere).
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // (b) Limb darkening — transparent core → darker toward the rim, so the surface curves
  // away at the edges (a lit sphere, not a flat disk).
  if (limb > 0) {
    const lg = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    lg.addColorStop(0, "rgba(0,0,0,0)");
    lg.addColorStop(0.72, "rgba(0,0,0,0)");
    lg.addColorStop(1, `rgba(0,0,0,${0.55 * limb})`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // (c) Bottom density — a downward vertical darkening so the base sinks and the body
  // carries mass (top stays open). Linear top→bottom, clipped to the sphere.
  if (bottom > 0) {
    const bg = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(0.55, "rgba(0,0,0,0)");
    bg.addColorStop(1, `rgba(0,0,0,${0.5 * bottom})`);
    ctx.fillStyle = bg;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // (d) Specular — a small, faint highlight offset toward the upper-left implying one light
  // direction. Kept very low; the additive interior passes still layer on top afterwards.
  if (specular > 0) {
    const sx = cx - radius * 0.32;
    const sy = cy - radius * 0.4;
    const sr = radius * 0.5;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, `rgba(255,246,228,${0.5 * specular})`);
    sg.addColorStop(0.5, `rgba(255,246,228,${0.18 * specular})`);
    sg.addColorStop(1, "rgba(255,246,228,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
