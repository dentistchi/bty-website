/**
 * Center recovery wiring for Arena ejection: on ejection, ensure ACK phase + diagnostic prompts;
 * on lift: Foundry routing + recommendations refresh after `arena_status` returns to ACTIVE.
 *
 * Wired from `arena-center-ejection` — do not import that module here (avoid cycles).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecommendations } from "@/engine/foundry/program-recommender.service";
import { getPhaseDiagnosticPrompts } from "@/engine/healing/healing-content.service";
import { getCurrentPhase, type HealingPhase } from "@/engine/healing/healing-phase.service";
import { routeHealingToFoundry } from "@/engine/integration/center-foundry-router";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resetHealingJourney } from "@/lib/bty/center/healingPhaseService";

export type EjectionLifecycleEvent = "EJECTED" | "LIFTED";

export type EjectionRecoveryPromptsPayload = {
  userId: string;
  phase: HealingPhase;
  /** Korean CTAs from {@link getPhaseDiagnosticPrompts}. */
  prompts: string[];
};

const recoveryPromptListeners = new Set<
  (payload: EjectionRecoveryPromptsPayload) => void | Promise<void>
>();

/**
 * Fired after ejection when prompts are computed (UI / notification layer).
 */
export function onEjectionRecoveryPrompts(
  listener: (payload: EjectionRecoveryPromptsPayload) => void | Promise<void>,
): () => void {
  recoveryPromptListeners.add(listener);
  return () => recoveryPromptListeners.delete(listener);
}

async function emitRecoveryPrompts(payload: EjectionRecoveryPromptsPayload): Promise<void> {
  for (const fn of recoveryPromptListeners) {
    try {
      await fn(payload);
    } catch {
      /* listeners must not break recovery */
    }
  }
}

/**
 * When the user has no `user_healing_phase` row, assign **ACKNOWLEDGEMENT** (not {@link advancePhase},
 * which would move a missing phase to REFLECTION).
 */
async function ensureAcknowledgementPhaseIfMissing(
  userId: string,
  client: SupabaseClient,
): Promise<HealingPhase> {
  const current = await getCurrentPhase(userId, client);
  if (current != null) return current;

  const now = new Date().toISOString();
  const { error } = await client.from("user_healing_phase").upsert(
    {
      user_id: userId,
      phase: "ACKNOWLEDGEMENT",
      started_at: now,
      completed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return "ACKNOWLEDGEMENT";
}

/**
 * Single entry: **`EJECTED`** after `arena_ejected` is emitted; **`LIFTED`** after `liftEjection`
 * sets `arena_status` to **ACTIVE** (call order: lift persistence → this handler).
 */
export async function handleEjectionLifecycle(
  userId: string,
  event: EjectionLifecycleEvent,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return;

  if (event === "EJECTED") {
    const phase = await ensureAcknowledgementPhaseIfMissing(userId, client);
    const prompts = getPhaseDiagnosticPrompts(phase);
    await emitRecoveryPrompts({ userId, phase, prompts });
    await resetHealingJourney(client, userId).catch((err) =>
      console.warn("[handleEjectionLifecycle] resetHealingJourney", err),
    );
    return;
  }

  // LIFTED
  const currentPhase = (await getCurrentPhase(userId, client)) ?? "ACKNOWLEDGEMENT";
  await routeHealingToFoundry(userId, currentPhase, { supabase: client });
  await getRecommendations(userId, client).catch((err) =>
    console.warn("[handleEjectionLifecycle] getRecommendations", err),
  );
}
