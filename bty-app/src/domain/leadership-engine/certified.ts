/**
 * Leadership Engine — Certified (Leader only).
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §7A, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P5.
 *
 * Certified is dynamic; re-evaluated quarterly and weekly.
 * Conditions: AIR_14d >= 0.80, MWD_14d >= threshold, Reset compliance met, No integrity_slip in 14d.
 *
 * Pure domain only; no UI, API, or DB.
 */

import { TII_TARGET_MWD_DEFAULT } from "./tii";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CERTIFIED_AIR_14D_MIN = 0.8 as const;
/** Default MWD threshold (same as TII target: ~2.1 micro wins per week). */
export const CERTIFIED_MWD_THRESHOLD_DEFAULT = TII_TARGET_MWD_DEFAULT;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inputs for Certified evaluation. All provided by caller (API from logs/snapshots). */
export interface CertifiedInputs {
  /** AIR over rolling 14d (0–1). */
  air14d: number;
  /** MWD over 14d (e.g. completed_verified_micro_wins / 14 or per-week avg). Same scale as TII: MWD_14d = count/14. */
  mwd14d: number;
  /** Whether reset compliance is met (e.g. when forced reset occurred, completed within 48h in last 90d; or 90d内 2 completed resets). */
  resetComplianceMet: boolean;
  /** No integrity_slip in the last 14d (3 consecutive missed windows). */
  noIntegritySlipIn14d: boolean;
  /** Optional MWD threshold; default CERTIFIED_MWD_THRESHOLD_DEFAULT. */
  mwdThreshold?: number;
}

export interface CertifiedStatusResult {
  current: boolean;
  reasons_met: string[];
  reasons_missing: string[];
}

const REASON_AIR = "air_14d_ge_80";
const REASON_MWD = "mwd_14d_ge_threshold";
const REASON_RESET = "reset_compliance_met";
const REASON_NO_SLIP = "no_integrity_slip_in_14d";

// ---------------------------------------------------------------------------
// Core — pure, deterministic
// ---------------------------------------------------------------------------

/**
 * Returns Certified status with reasons. Certified is leader-only and dynamic.
 */
export function certifiedStatus(inputs: CertifiedInputs): CertifiedStatusResult {
  const threshold = inputs.mwdThreshold ?? CERTIFIED_MWD_THRESHOLD_DEFAULT;
  const reasons_met: string[] = [];
  const reasons_missing: string[] = [];

  if (inputs.air14d >= CERTIFIED_AIR_14D_MIN) {
    reasons_met.push(REASON_AIR);
  } else {
    reasons_missing.push(REASON_AIR);
  }

  if (inputs.mwd14d >= threshold) {
    reasons_met.push(REASON_MWD);
  } else {
    reasons_missing.push(REASON_MWD);
  }

  if (inputs.resetComplianceMet) {
    reasons_met.push(REASON_RESET);
  } else {
    reasons_missing.push(REASON_RESET);
  }

  if (inputs.noIntegritySlipIn14d) {
    reasons_met.push(REASON_NO_SLIP);
  } else {
    reasons_missing.push(REASON_NO_SLIP);
  }

  const current = reasons_missing.length === 0;
  return { current, reasons_met, reasons_missing };
}

/**
 * Returns true when all Certified conditions are met (Leader only).
 * Re-evaluated quarterly and weekly.
 */
export function isCertified(inputs: CertifiedInputs): boolean {
  return certifiedStatus(inputs).current;
}
