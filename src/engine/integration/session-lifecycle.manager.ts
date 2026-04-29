/**
 * Session lifecycle orchestrator — Arena start/end + Center diagnostic completion.
 *
 * - **Arena START** → {@link buildArenaContext}
 * - **Arena END** → {@link processSessionOutcome} → {@link validateXPAward} (core + weekly) →
 *   {@link syncAvatarStateAfterCoreXpChange} when core award allowed → optional
 *   {@link routeHealingToFoundry} when healing phase is active (see event flag)
 * - **Center diagnostic COMPLETE** → {@link advancePhase} → {@link routeHealingToFoundry} →
 *   {@link buildMentorContext} refresh
 *
 * Entry: {@link handleSessionEvent}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAvatarStateAfterCoreXpChange } from "@/engine/avatar/avatar-state.service";
import { advancePhase, getCurrentPhase } from "@/engine/healing/healing-phase.service";
import type { HealingPhase } from "@/engine/healing/healing-phase.service";
import { buildMentorContext } from "@/engine/rag/mentor-context.service";
import { buildArenaContext } from "@/engine/integration/arena-context.injector";
import {
  HEALING_FOUNDRY_PHASES,
  routeHealingToFoundry,
  type RouteHealingToFoundryDeps,
} from "@/engine/integration/center-foundry-router";
import {
  processSessionOutcome,
  type ArenaSessionResult,
  type ProcessSessionOutcomeDeps,
} from "@/engine/integration/arena-foundry-bridge";
import { validateXPAward } from "@/engine/integration/xp-integrity-bridge";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type SessionEvent =
  | {
      kind: "arena_session_start";
      supabase?: SupabaseClient;
    }
  | {
      kind: "arena_session_end";
      sessionResult: ArenaSessionResult;
      xp: {
        core: { previousTotal: number; gain: number };
        weekly: { amount: number };
      };
      processSessionOutcomeDeps?: ProcessSessionOutcomeDeps;
      /**
       * When `true`, if {@link getCurrentPhase} is REFLECTION / REINTEGRATION / RENEWAL,
       * runs {@link routeHealingToFoundry} (Foundry assign / Elite unlock). Default `false` to avoid duplicate emits.
       */
      routeHealingFoundryIfHealingPhaseActive?: boolean;
      routeHealingFoundryDeps?: RouteHealingToFoundryDeps;
      supabase?: SupabaseClient;
    }
  | {
      kind: "center_diagnostic_complete";
      supabase?: SupabaseClient;
      routeHealingDeps?: RouteHealingToFoundryDeps;
    };

function isRoutableHealingPhase(phase: HealingPhase | null): phase is HealingPhase {
  if (phase == null) return false;
  return (HEALING_FOUNDRY_PHASES as readonly string[]).includes(phase);
}

/**
 * System-wide session hook: run the appropriate pipeline for `event.kind`.
 */
export async function handleSessionEvent(userId: string, event: SessionEvent): Promise<void> {
  switch (event.kind) {
    case "arena_session_start": {
      await buildArenaContext(userId, event.supabase);
      return;
    }
    case "arena_session_end": {
      const client = event.supabase ?? (await getSupabaseServerClient());
      await processSessionOutcome(userId, event.sessionResult, event.processSessionOutcomeDeps);

      const [coreAward, weeklyAward] = await Promise.all([
        validateXPAward(userId, "core", event.xp.core.gain),
        validateXPAward(userId, "weekly", event.xp.weekly.amount),
      ]);

      if (coreAward.allowed && coreAward.allowedAmount > 0) {
        const prev = event.xp.core.previousTotal;
        const next = prev + coreAward.allowedAmount;
        await syncAvatarStateAfterCoreXpChange(userId, client, prev, next);
      }

      if (event.routeHealingFoundryIfHealingPhaseActive) {
        const phase = await getCurrentPhase(userId, client);
        if (isRoutableHealingPhase(phase)) {
          await routeHealingToFoundry(userId, phase, {
            ...event.routeHealingFoundryDeps,
            supabase: client,
          });
        }
      }
      return;
    }
    case "center_diagnostic_complete": {
      const client = event.supabase ?? (await getSupabaseServerClient());
      const nextPhase = await advancePhase(userId, client);
      await routeHealingToFoundry(userId, nextPhase, {
        ...event.routeHealingDeps,
        supabase: client,
      });
      await buildMentorContext(userId, client);
      return;
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
