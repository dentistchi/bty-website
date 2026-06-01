/**
 * Certified input-assembly (seams 1+2 folded; DESIGN_V1 sections 3/4).
 * Pure computeCertifiedInputs + thin I/O buildCertifiedInputs
 * (forced-reset-eval-inputs.server.ts precedent: pure fn + I/O in one .server file).
 *
 * Seam 1 (MWD): rate = count(micro_win && verified && completed within 14d) / 14,
 *   anchored on completed_at (distinct from AIR's chosen_at). verified required.
 *   certifiedStatus compares mwd14d >= threshold raw (no normalizeMWD on certified path).
 * Seam 2 (resetComplianceMet): current-pending-honored (Commander §4 amendment) —
 *   triggered==null -> true; now <= resetDueAt(+48h) -> true; overdue -> false.
 *   90d-letter underivable (forced_reset_triggered_at erase-on-clear, no audit table).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAIR, type ActivationRecord } from "@/domain/leadership-engine/air";
import type { CertifiedInputs } from "@/domain/leadership-engine/certified";
import { loadActivationRecordsForUser } from "./forced-reset-eval-inputs.server";
import { getLeadershipEngineState } from "./state-service";

const MS_PER_DAY = 86_400_000;
const MWD_WINDOW_DAYS = 14;

export interface CertifiedResetState {
  forcedResetTriggeredAt: string | null;
  resetDueAt: string | null;
}

function mwd14dRate(activations: ActivationRecord[], now: Date): number {
  const cutoff = now.getTime() - MWD_WINDOW_DAYS * MS_PER_DAY;
  const nowMs = now.getTime();
  const completedVerified = activations.filter((a) => {
    if (a.type !== "micro_win" || !a.verified || a.completed_at == null) {
      return false;
    }
    const t = a.completed_at.getTime();
    return t >= cutoff && t <= nowMs;
  }).length;
  return completedVerified / MWD_WINDOW_DAYS;
}

/**
 * Shared 14d activation-derived gating fields for Certified AND LRI.
 * Single source so seam-1 MWD rule + AIR 14d window cannot diverge between the two
 * promotion-gating metrics. air14d/noIntegritySlip via computeAIR(chosen_at anchor);
 * mwd14d via mwd14dRate(completed_at anchor, verified+/14).
 */
export function activationDerived14d(
  activations: ActivationRecord[],
  now: Date,
): { air14d: number; mwd14d: number; noIntegritySlipIn14d: boolean } {
  const air = computeAIR(activations, "14d", now);
  return {
    air14d: air.air,
    mwd14d: mwd14dRate(activations, now),
    noIntegritySlipIn14d: !air.integritySlip,
  };
}

function resetComplianceMet(reset: CertifiedResetState, now: Date): boolean {
  if (reset.forcedResetTriggeredAt == null) return true;
  if (reset.resetDueAt == null) return false;
  return now.getTime() <= Date.parse(reset.resetDueAt);
}

export function computeCertifiedInputs(
  activations: ActivationRecord[],
  resetState: CertifiedResetState,
  now: Date,
): CertifiedInputs {
  const d = activationDerived14d(activations, now);
  return {
    air14d: d.air14d,
    mwd14d: d.mwd14d,
    resetComplianceMet: resetComplianceMet(resetState, now),
    noIntegritySlipIn14d: d.noIntegritySlipIn14d,
  };
}

export async function buildCertifiedInputs(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<CertifiedInputs> {
  const [activations, state] = await Promise.all([
    loadActivationRecordsForUser(supabase, userId),
    getLeadershipEngineState(supabase, userId),
  ]);
  return computeCertifiedInputs(
    activations,
    {
      forcedResetTriggeredAt: state.forcedResetTriggeredAt,
      resetDueAt: state.resetDueAt,
    },
    now,
  );
}
