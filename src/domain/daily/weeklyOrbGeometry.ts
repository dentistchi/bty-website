/**
 * Weekly Orb geometry (Slice 3.2C-B3A.2D-R3) — PURE, deterministic placement of the Me weekly
 * trace's lights. Exactly {@link WEEKLY_LIGHT_COUNT} = 7 light centroids, one per BTY day
 * (index 0 = oldest … index 6 = today). No eighth/central light is ever produced here; the Orb's
 * ambient body glow is a separate diffuse paint, NOT a light model.
 *
 * The trajectory is intentionally BOUNDED so the lights can never collapse to the centre or merge:
 *   angle_i(t) = baseRotation(t) + 2π·i/7 + smallBoundedDrift_i(t)
 *   radius_i(t) = BASE_R + smallBoundedBreathing_i(t)   (BASE_R - RADIAL_AMP > 0 → never reaches 0)
 * Per-index offsets are deterministic (no Math.random) so the animation is stable and the geometry
 * is unit-testable across sampled phases.
 */

export const WEEKLY_LIGHT_COUNT = 7;

// Fractions of the canvas size. BASE_R keeps the ring well away from the centre; RADIAL_AMP is a
// small breathing band with BASE_R - RADIAL_AMP > 0 (no collapse). ANGULAR_AMP is bounded so
// neighbouring lights (2π/7 ≈ 0.898 rad apart) never overlap angularly.
export const BASE_R_FRAC = 0.3;
export const RADIAL_AMP_FRAC = 0.03;
export const ANGULAR_AMP = 0.09; // radians
const ROTATION_PERIOD_S = 40; // one calm revolution per 40s

export type OrbLight = {
  /** Day index: 0 = oldest … 6 = today. */
  i: number;
  x: number;
  y: number;
  /** Distance of the centroid from the Orb centre (always > 0). */
  distFromCenter: number;
  isToday: boolean;
};

/** The seven light centroids at animation time `t` (seconds) for a square canvas of `size` px. */
export function weeklyOrbLights(t: number, size: number): OrbLight[] {
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * BASE_R_FRAC;
  const radialAmp = size * RADIAL_AMP_FRAC;
  const baseRotation = t * ((Math.PI * 2) / ROTATION_PERIOD_S);
  const lights: OrbLight[] = [];
  for (let i = 0; i < WEEKLY_LIGHT_COUNT; i++) {
    const phase = i * 1.7; // deterministic per-index offset → no synchronized motion
    const drift = ANGULAR_AMP * Math.sin(t * 0.5 + phase);
    const breathe = radialAmp * Math.sin(t * 0.7 + phase * 1.3);
    const angle = baseRotation + (Math.PI * 2 * i) / WEEKLY_LIGHT_COUNT + drift;
    const r = baseR + breathe; // ∈ [baseR - radialAmp, baseR + radialAmp], strictly > 0
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    lights.push({ i, x, y, distFromCenter: Math.hypot(x - cx, y - cy), isToday: i === WEEKLY_LIGHT_COUNT - 1 });
  }
  return lights;
}

/** Lower bound on any light's distance from centre — proves "no collapse" without sampling. */
export function minLightRadius(size: number): number {
  return size * (BASE_R_FRAC - RADIAL_AMP_FRAC);
}

/**
 * Collision-aware inline-popup placement (pure). Prefer ABOVE the anchor (the approved anchor);
 * flip BELOW when the above-placement top would cross the top safe area, provided below fits; if
 * neither fits fully, stay above (the caller applies a compact max-height with internal scroll).
 */
export function choosePopupPlacement(p: {
  anchorTop: number;
  anchorBottom: number;
  popupHeight: number;
  viewportHeight: number;
  safeTop?: number;
  safeBottom?: number;
  margin?: number;
}): "above" | "below" {
  const safeTop = p.safeTop ?? 0;
  const safeBottom = p.safeBottom ?? 0;
  const margin = p.margin ?? 8;
  const topIfAbove = p.anchorTop - margin - p.popupHeight;
  if (topIfAbove >= safeTop) return "above";
  const bottomIfBelow = p.anchorBottom + margin + p.popupHeight;
  if (bottomIfBelow <= p.viewportHeight - safeBottom) return "below";
  return "above";
}
