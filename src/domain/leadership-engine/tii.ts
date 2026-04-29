/**
 * Leadership Engine — TII (Team Integrity Index).
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §6, docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md §4 P4.
 *
 * TII = (Avg AIR × 0.60) + (Avg MWD_normalized × 0.25) + (TSP_normalized × 0.15)
 *
 * Normalization:
 * - AIR: 0–1 (clamp).
 * - MWD: min(mwd_7d / target_mwd, 1.0); target_mwd default 0.30.
 * - TSP: (score - 1) / 4 (TSP scale 1..5 → 0..1).
 *
 * Policy: only team score is public; individual AIR never exposed.
 * Pure domain only; no UI, API, or DB.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TII_WEIGHT_AIR = 0.6 as const;
export const TII_WEIGHT_MWD = 0.25 as const;
export const TII_WEIGHT_TSP = 0.15 as const;
/** Default target MWD (e.g. ~2.1 micro wins per week). */
export const TII_TARGET_MWD_DEFAULT = 0.3 as const;
/** TSP scale: 1..5. Normalized to 0..1 via (tsp - 1) / 4. */
export const TSP_MIN = 1 as const;
export const TSP_MAX = 5 as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inputs for TII computation (team-level aggregates only; no per-user AIR). */
export type TIIInputs = {
  /** Team average AIR (0–1). */
  avgAIR: number;
  /** Team average MWD_7d (e.g. completed_verified_micro_wins / 7). */
  avgMWD: number;
  /** Team Stability Pulse, scale 1..5. */
  tsp: number;
  /** Optional; default TII_TARGET_MWD_DEFAULT. */
  targetMwd?: number;
  [k: string]: unknown;
};

/** Public result: team-level only. Individual AIR never exposed. */
export type TIIResult = {
  tii: number;
  avg_air: number;
  avg_mwd: number;
  tsp: number;
  /** Normalized components (0..1) for audit/debug; optional in API. */
  components?: {
    air_normalized: number;
    mwd_normalized: number;
    tsp_normalized: number;
  };
};

// ---------------------------------------------------------------------------
// Normalization (deterministic, pure)
// ---------------------------------------------------------------------------

/** Clamp AIR to 0..1. */
export function normalizeAIR(air: number): number {
  return Math.max(0, Math.min(1, air));
}

/** MWD normalized by target: min(avgMWD / targetMwd, 1.0). */
export function normalizeMWD(avgMWD: number, targetMwd: number = TII_TARGET_MWD_DEFAULT): number {
  if (targetMwd <= 0) return 0;
  return Math.min(avgMWD / targetMwd, 1);
}

/** TSP 1..5 → 0..1: (score - 1) / 4. */
export function normalizeTSP(tsp: number): number {
  const clamped = Math.max(TSP_MIN, Math.min(TSP_MAX, tsp));
  return (clamped - 1) / 4;
}

// ---------------------------------------------------------------------------
// Core computation — pure, deterministic
// ---------------------------------------------------------------------------

/**
 * Computes Team Integrity Index from team-level inputs.
 * Weights: Avg AIR 0.6, MWD_normalized 0.25, TSP_normalized 0.15.
 * Returns value in [0, 1].
 */
export function computeTII(inputs: TIIInputs): number {
  const targetMwd = inputs.targetMwd ?? TII_TARGET_MWD_DEFAULT;
  const airN = normalizeAIR(inputs.avgAIR);
  const mwdN = normalizeMWD(inputs.avgMWD, targetMwd);
  const tspN = normalizeTSP(inputs.tsp);
  return airN * TII_WEIGHT_AIR + mwdN * TII_WEIGHT_MWD + tspN * TII_WEIGHT_TSP;
}

/**
 * Same as computeTII but returns public result object (team-level only).
 * Use this for API responses; individual AIR is never in the result.
 */
export function computeTIIWithComponents(inputs: TIIInputs): TIIResult {
  const targetMwd = inputs.targetMwd ?? TII_TARGET_MWD_DEFAULT;
  const airN = normalizeAIR(inputs.avgAIR);
  const mwdN = normalizeMWD(inputs.avgMWD, targetMwd);
  const tspN = normalizeTSP(inputs.tsp);
  const tii = airN * TII_WEIGHT_AIR + mwdN * TII_WEIGHT_MWD + tspN * TII_WEIGHT_TSP;
  return {
    tii,
    avg_air: inputs.avgAIR,
    avg_mwd: inputs.avgMWD,
    tsp: inputs.tsp,
    components: {
      air_normalized: airN,
      mwd_normalized: mwdN,
      tsp_normalized: tspN,
    },
  };
}
