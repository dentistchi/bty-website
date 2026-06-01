/**
 * LRI input-assembly (DESIGN_V1 section 3; seam 3 pulse raw-mean).
 * Pure computeLRIInputs + thin I/O buildLRIInputs (forced-reset/certified precedent).
 *
 * Shares activationDerived14d with Certified (single source, no MWD/AIR drift).
 * Pulse: computePulse14d returns raw pulseMean (1..5) -> personalResponsibilityPulse;
 *   computeLRI normalizes once (seam 3). hasPulse=false -> { pending: true }, NO 2-term
 *   collapse (design §3). The pending branch is owned by the step-5 route — this union
 *   is NOT routed through getLRI(B) (GetLRIInputs has no union; getLRI calls computeLRI
 *   unconditionally). Route does: r.pending ? lri=null : computeLRI(r.inputs).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ActivationRecord } from "@/domain/leadership-engine/air";
import type { LRIInputs } from "@/domain/leadership-engine/lri";
import { computePulse14d, type PulseRecord } from "@/domain/leadership-engine/pulse";
import { loadActivationRecordsForUser } from "./forced-reset-eval-inputs.server";
import { activationDerived14d } from "./certified-inputs.server";

export type LRIInputsResult =
  | { pending: true }
  | { pending: false; inputs: LRIInputs };

export function computeLRIInputs(
  activations: ActivationRecord[],
  pulseRows: PulseRecord[],
  now: Date,
): LRIInputsResult {
  const { pulseMean, hasPulse } = computePulse14d(pulseRows, now);
  if (!hasPulse) {
    return { pending: true };
  }
  const d = activationDerived14d(activations, now);
  return {
    pending: false,
    inputs: {
      air14d: d.air14d,
      mwd14d: d.mwd14d,
      personalResponsibilityPulse: pulseMean,
      noIntegritySlipIn14d: d.noIntegritySlipIn14d,
    },
  };
}

async function loadPulseRowsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PulseRecord[]> {
  const { data, error } = await supabase
    .from("le_pulse_log")
    .select("pulse_value, created_at")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r) => ({
    pulse_value: Number((r as { pulse_value: number }).pulse_value),
    created_at: new Date(String((r as { created_at: string }).created_at)),
  }));
}

export async function buildLRIInputs(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<LRIInputsResult> {
  const [activations, pulseRows] = await Promise.all([
    loadActivationRecordsForUser(supabase, userId),
    loadPulseRowsForUser(supabase, userId),
  ]);
  return computeLRIInputs(activations, pulseRows, now);
}
