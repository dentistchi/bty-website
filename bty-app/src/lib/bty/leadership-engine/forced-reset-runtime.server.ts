/**
 * Wires domain {@link evaluateForcedReset} + {@link resetStateTransitionHandler} after AIR inputs exist.
 * Call from GET /air (stage 3 only) and from cron for stage-3 users.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivationRecord } from "@/domain/leadership-engine/air";
import { STAGE_3 } from "@/domain/leadership-engine";
import { getLeadershipEngineState, resetStateTransitionHandler } from "@/lib/bty/leadership-engine/state-service";
import { buildForcedResetEvalInputs } from "@/lib/bty/leadership-engine/forced-reset-eval-inputs.server";

/**
 * If user is LE stage 3, evaluates forced-reset inputs (same activations as AIR) and may transition to stage 4.
 * Swallows errors so callers (e.g. GET /air) stay reliable.
 */
export async function runForcedResetAfterAirIfStage3(
  supabase: SupabaseClient,
  userId: string,
  activations: readonly ActivationRecord[],
  now: Date = new Date(),
): Promise<void> {
  try {
    const { currentStage } = await getLeadershipEngineState(supabase, userId);
    if (currentStage !== STAGE_3) return;

    const inputs = await buildForcedResetEvalInputs(supabase, userId, activations, now);
    const result = await resetStateTransitionHandler(supabase, userId, inputs);
    if (result.triggered) {
      console.info("[forced_reset] runtime stage_4", {
        userId,
        reasons: result.reasons,
      });
    }
  } catch (e) {
    console.error("[forced_reset] runtime_eval_failed", {
      userId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
