/**
 * Leadership Engine — LRI (Leadership Readiness Index, non-leader).
 * Single source: docs/LEADERSHIP_ENGINE_SPEC.md §7B, ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §4 P5.
 *
 * LRI = 0.50 * AIR_14d + 0.30 * MWD_normalized + 0.20 * personal_responsibility_pulse
 * If LRI >= 0.80 and no integrity_slip → readiness_flag = true.
 * Promotion requires leader_approval(user_id, approver_id).
 *
 * Pure domain only; no UI, API, or DB.
 */

import { normalizeMWD, TII_TARGET_MWD_DEFAULT } from "./tii";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LRI_WEIGHT_AIR = 0.5 as const;
export const LRI_WEIGHT_MWD = 0.3 as const;
export const LRI_WEIGHT_PULSE = 0.2 as const;
export const LRI_READINESS_THRESHOLD = 0.8 as const;
/** Personal responsibility pulse scale 1..5; normalized to 0..1 as (pulse - 1) / 4. */
export const PULSE_MIN = 1 as const;
export const PULSE_MAX = 5 as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inputs for LRI computation (non-leader). */
export interface LRIInputs {
  /** AIR over rolling 14d (0–1). */
  air14d: number;
  /** MWD over 14d (or 7d); normalized by target for formula. */
  mwd14d: number;
  /** Personal responsibility pulse: "I can take responsibility without avoidance" 1..5. */
  personalResponsibilityPulse: number;
  /** No integrity_slip in 14d. */
  noIntegritySlipIn14d: boolean;
  /** Optional MWD target for normalization; default TII_TARGET_MWD_DEFAULT. */
  targetMwd?: number;
}

export interface LRIResult {
  lri: number;
  readiness_flag: boolean;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize personal responsibility pulse 1..5 → 0..1. */
export function normalizePersonalPulse(pulse: number): number {
  const clamped = Math.max(PULSE_MIN, Math.min(PULSE_MAX, pulse));
  return (clamped - 1) / 4;
}

// ---------------------------------------------------------------------------
// Core — pure, deterministic
// ---------------------------------------------------------------------------

/**
 * Computes LRI and readiness flag. LRI is non-public; readiness_flag drives promotion eligibility.
 */
export function computeLRI(inputs: LRIInputs): LRIResult {
  const targetMwd = inputs.targetMwd ?? TII_TARGET_MWD_DEFAULT;
  const airN = Math.max(0, Math.min(1, inputs.air14d));
  const mwdN = normalizeMWD(inputs.mwd14d, targetMwd);
  const pulseN = normalizePersonalPulse(inputs.personalResponsibilityPulse);

  const lri = airN * LRI_WEIGHT_AIR + mwdN * LRI_WEIGHT_MWD + pulseN * LRI_WEIGHT_PULSE;
  const reasons: string[] = [];
  reasons.push(`air_14d=${inputs.air14d.toFixed(2)}`);
  reasons.push(`mwd_normalized=${mwdN.toFixed(2)}`);
  reasons.push(`pulse_normalized=${pulseN.toFixed(2)}`);
  reasons.push(`lri=${lri.toFixed(2)}`);

  const readiness_flag =
    lri >= LRI_READINESS_THRESHOLD && inputs.noIntegritySlipIn14d;
  if (readiness_flag) {
    reasons.push("readiness_flag=true");
  } else if (lri < LRI_READINESS_THRESHOLD) {
    reasons.push("readiness_flag=false:lri_below_threshold");
  } else {
    reasons.push("readiness_flag=false:integrity_slip");
  }

  return { lri, readiness_flag, reasons };
}

/**
 * Returns true when promotion to leader track is allowed by rule.
 * Requires candidate has readiness_flag and approver is a certified leader.
 */
export function canApproveLeaderTrack(
  candidateReadinessFlag: boolean,
  approverIsCertifiedLeader: boolean
): boolean {
  return candidateReadinessFlag && approverIsCertifiedLeader;
}
