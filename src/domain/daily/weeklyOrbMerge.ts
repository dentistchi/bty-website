/**
 * Weekly Orb merge cycle (restored, Slice 3.2C-B3A.2D-R3.1) — the ORIGINAL STEP-6
 * "7 distinct days → one weekly light → 7 distinct days" transformation, extracted verbatim from
 * WeeklyOrb's draw so it is unit-testable. The centre convergence is INTENTIONAL (revoking the R3
 * anti-convergence rule): the seven daily nodes gather inward, dissolve into one luminous central
 * form for a brief hold, then release and re-emerge — continuously.
 *
 * These are the exact values WeeklyOrb paints with; changing them changes the animation.
 */

export const MERGE_CYCLE_S = 8; // seconds: gather → brief merge hold → release → rest
export const WEEKLY_NODE_COUNT = 7; // the seven daily nodes (the central form is NOT an 8th node)

/** Smooth 0→1 ease so gather / release / absorption never snap. */
export function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * Merge amount m at animation time `t` (seconds): 0 = released (seven distinct), 1 = merged (one
 * light). Reduced motion holds a released frame (m = 0). Phases within each ~8s cycle:
 *   gather (cyc<0.47) → merge hold (0.47–0.55, m=1) → release (0.55–0.9) → rest (≥0.9, m=0).
 */
export function mergeAmount(t: number, reduceMotion = false): number {
  if (reduceMotion) return 0;
  const cyc = (((t % MERGE_CYCLE_S) + MERGE_CYCLE_S) % MERGE_CYCLE_S) / MERGE_CYCLE_S;
  if (cyc < 0.47) return smoothstep(0.06, 0.47, cyc); // gather
  if (cyc < 0.55) return 1; // merge hold (~0.64s "one light")
  if (cyc < 0.9) return 1 - smoothstep(0.55, 0.9, cyc); // release
  return 0; // rest — seven distinct living days
}

/** Late-peak absorption: individual node centres dissolve as the core flares (only near m→1). */
export function absorbHi(m: number, reduceMotion = false): number {
  return reduceMotion ? 0 : smoothstep(0.72, 1, m);
}

/** Node ring multiplier: nodes gather ~90% inward at full merge (1 → 0.1), re-expand on release. */
export function nodeGatherScale(m: number): number {
  return 1 - 0.9 * m;
}
