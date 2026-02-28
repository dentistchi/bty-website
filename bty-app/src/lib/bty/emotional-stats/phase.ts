/**
 * v3 acceleration_first_30_days and phase_tuning.
 * Single source: docs/specs/healing-coaching-spec-v3.json gain_algorithm.
 * Pure functions only.
 */

/** Day 1–7: 1.2, 8–21: 1, 22–30: 0.9; after 30: post_30_day_normalization 0.85. */
export function getPhaseMultiplier(userDay: number): number {
  if (userDay <= 0) return 1;
  if (userDay <= 7) return 1.2;
  if (userDay <= 21) return 1;
  if (userDay <= 30) return 0.9;
  return 0.85; // post_30_day_normalization
}

/** Consistency cap by phase: 1.4 (day 1–7), 1.3 (8–21), 1.2 (22–30); after 30 no extra cap (use 1.4). */
export function getConsistencyCap(userDay: number): number {
  if (userDay <= 0) return 1.4;
  if (userDay <= 7) return 1.4;
  if (userDay <= 21) return 1.3;
  if (userDay <= 30) return 1.2;
  return 1.4;
}
